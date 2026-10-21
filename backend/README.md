# Resend Backend — API Documentation

This document provides a comprehensive guide to the backend API for the Resend WhatsApp CRM application. All endpoints are versioned under `/api/v1`.

## 📂 Project Structure
The project follows a modular architecture:

- **models/**: Database models (schema definitions).
- **routes/**: API route handlers.
- **services/**: Business logic and external service integrations (e.g., WhatsApp, AI).
- **middlewares/**: Authentication and validation logic.

## 📚 Authentication

### Required Headers
All protected endpoints require the following headers:

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer <JWT_TOKEN>` |
| `x-user-id` | `user_id` |

### Endpoints

#### Register
**POST** `/api/user/signup`

Register a new user.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "[EMAIL_ADDRESS]",
  "password": "password123",
  "phone": "+1234567890",
  "referral_code": "OPTIONAL_CODE"
}
```

**Response:**
```json
{
  "data": {
    "created_at": "2024-01-01T00:00:00.000Z",
    "email": "[EMAIL_ADDRESS]",
    "id": 1,
    "name": "John Doe",
    "org_id": 1,
    "phone": "+1234567890"
  },
  "message": "User created successfully",
  "success": true
}
```

#### Login
**POST** `/api/user/login`

Login existing user.

**Request Body:**
```json
{
  "email": "[EMAIL_ADDRESS]",
  "password": "password123",
  "provider": "email" // email, google
}
```

**Response:**
```json
{
  "success": true,
  "token": "<JWT_TOKEN>",
  "message": "User logged in successfully",
  "data": { ...user }
}
```

#### Logout
**POST** `/api/user/logout`

Logout user.

**Response:**
```json
{
  "success": true,
  "data": null,
  "message": "User logged out successfully"
}
```

## 📨 WhatsApp

### Endpoints

#### Send WhatsApp Message
**POST** `/api/v1/whatsapp/send_message`

Send a WhatsApp message.

**Request Body:**
```json
{
  "to_number": "+919876543210",
  "body": "Hello from backend!",
  "media_url": null,
  "media_type": null,
  "file_name": null,
  "mime_type": null,
  "width": null,
  "height": null,
  "duration": null
}
```

**Response:**
```json
{
  "data": {
    "body": "Hello from backend!",
    "created_at": "2024-01-01T00:00:00.000Z",
    "from_number": "+911234567890",
    "id": 1,
    "org_id": 1,
    "status": "sent",
    "to_number": "+919876543210",
    "type": "text"
  },
  "message": "Message sent successfully",
  "success": true
}
```

### Message Types

| Type | Required Fields | Notes |
|------|-----------------|-------|
| `text` | `body` | Text message |
| `image` | `media_url`, `mime_type`, `width`, `height` | Image message |
| `video` | `media_url`, `mime_type`, `width`, `height`, `duration` | Video message |
| `document` | `media_url`, `mime_type`, `file_name` | Document message |
| `audio` | `media_url`, `mime_type`, `duration` | Audio message |

## 👥 Phonebook

### Endpoints

#### Get Contacts
**GET** `/api/v1/phonebook/get_uid_contacts`

Get user's contacts.

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "number": "+919876543210",
      "organization_id": 1,
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "message": "Contacts fetched successfully",
  "success": true
}
```

#### Add Contact
**POST** `/api/v1/phonebook/add_single_contact`

Add a new contact.

**Request Body:**
```json
{
  "name": "Jane Doe",
  "number": "+919876543211"
}
```

**Response:**
```json
{
  "data": {
    "id": 2,
    "name": "Jane Doe",
    "number": "+919876543211",
    "organization_id": 1,
    "created_at": "2024-01-01T00:00:00.000Z"
  },
  "message": "Contact added successfully",
  "success": true
}
```

#### Delete Contacts
**DELETE** `/api/v1/phonebook/del_contacts`

Delete multiple contacts.

**Request Body:**
```json
{
  "contact_ids": [1, 2, 3]
}
```

**Response:**
```json
{
  "data": 3,
  "message": "Contacts deleted successfully",
  "success": true
}
```

### Groups

#### Get Groups
**GET** `/api/v1/phonebook/get_by_uid`

Get user's contact groups.

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "organization_id": 1,
      "group_name": "Friends",
      "contacts": [...]
    }
  ],
  "message": "Groups fetched successfully",
  "success": true
}
```

#### Add Group
**POST** `/api/v1/phonebook/add`

Add a new group.

**Request Body:**
```json
{
  "group_name": "New Group",
  "contact_ids": [1, 2, 3]
}
```

**Response:**
```json
{
  "data": {
    "group_id": 1,
    "group_name": "New Group",
    "contact_ids": [1, 2, 3]
  },
  "message": "Group created successfully",
  "success": true
}
```

#### Delete Group
**DELETE** `/api/v1/phonebook/del_phonebook`

Delete a group.

**Request Body:**
```json
{
  "group_id": 1
}
```

**Response:**
```json
{
  "data": 1,
  "message": "Group deleted successfully",
  "success": true
}
```

## 📂 Inbox

### Endpoints

#### Get Chats
**GET** `/api/v1/inbox/get_chats`


