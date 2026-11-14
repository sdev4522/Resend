// Converts a stored inbox audio file to MP3 for the calling workspace only.
// The message must belong to `uid` and `audioUrl` must be that message's own
// audio link; the file must sit inside client/public. Without these checks a
// caller could rewrite other tenants' messages or delete arbitrary files.
const path = require("path");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const { prisma } = require("../database/prisma.js");
const { idParam, whereStr } = require("../database/prismaHelpers");
const logger = require("../utils/logger.js");

const PUBLIC_ROOT = path.resolve(__dirname, "../client/public");

function samePath(a, b) {
  try {
    return new URL(a).pathname === new URL(b, a).pathname;
  } catch {
    return false;
  }
}

async function convertOwnedAudio(uid, { msgId, audioUrl }) {
  if (!uid) return { success: false, msg: "Unauthorized" };
  if (!audioUrl || !msgId) {
    return { success: false, msg: "Audio URL and message id are required" };
  }

  let urlObj;
  try {
    urlObj = new URL(audioUrl);
  } catch {
    return { success: false, msg: "Invalid audio URL" };
  }

  const msg = await prisma.beta_conversation.findFirst({
    where: { id: idParam(msgId), uid: whereStr(uid) },
  });
  if (!msg) return { success: false, msg: "Message not found" };

  let msgCon = {};
  try {
    msgCon = msg.msgContext ? JSON.parse(msg.msgContext) : {};
  } catch {
    msgCon = {};
  }
  const storedLink = msgCon?.audio?.link;
  if (!storedLink || !samePath(audioUrl, storedLink)) {
    return { success: false, msg: "Audio does not belong to this message" };
  }

  let pathname;
  try {
    pathname = decodeURIComponent(urlObj.pathname);
  } catch {
    return { success: false, msg: "Invalid audio URL" };
  }
  const oldFilePath = path.resolve(PUBLIC_ROOT, "." + pathname);
  if (!oldFilePath.startsWith(PUBLIC_ROOT + path.sep)) {
    return { success: false, msg: "Invalid audio path" };
  }

  const originalFilename = path.basename(oldFilePath);
  const ext = path.extname(originalFilename);
  if (ext.toLowerCase() === ".mp3") {
    return { success: true, newUrl: audioUrl, msg: "Already in MP3 format" };
  }
  if (!fs.existsSync(oldFilePath)) {
    return { success: false, msg: "Original audio file not found on server" };
  }

  const newFilename = `${path.basename(originalFilename, ext)}.mp3`;
  const newFilePath = path.join(path.dirname(oldFilePath), newFilename);
  const directory = path
    .relative(PUBLIC_ROOT, path.dirname(oldFilePath))
    .split(path.sep)
    .join("/");
  const newUrl = `${urlObj.origin}/${directory ? directory + "/" : ""}${newFilename}`;

  ffmpeg.setFfmpegPath(ffmpegStatic);
  await new Promise((resolve, reject) => {
    ffmpeg(oldFilePath)
      .noVideo()
      .audioCodec("libmp3lame")
      .audioBitrate(128)
      .audioChannels(2)
      .audioFrequency(44100)
      .outputOptions(["-write_xing 0", "-id3v2_version", "3"])
      .format("mp3")
      .on("end", resolve)
      .on("error", (err) => {
        logger.error("FFmpeg conversion error:", err);
        reject(err);
      })
      .save(newFilePath);
  });

  if (!fs.existsSync(newFilePath) || fs.statSync(newFilePath).size === 0) {
    return { success: false, msg: "Conversion produced empty or missing file" };
  }

  await prisma.beta_conversation.update({
    where: { id: msg.id },
    data: {
      msgContext: JSON.stringify({
        ...msgCon,
        type: "audio",
        audio: { ...msgCon.audio, link: newUrl },
      }),
    },
  });

  fs.unlinkSync(oldFilePath);

  return {
    success: true,
    newUrl,
    oldFile: originalFilename,
    newFile: newFilename,
    msg: "Audio converted to MP3 successfully",
  };
}

module.exports = { convertOwnedAudio };
