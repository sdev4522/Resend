export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3010";
export const SOCKET_BASE_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3010";

export const API_ENDPOINTS = {
  auth: {
    login: "/api/user/login",
    register: "/api/user/signup",
    logout: "/api/user/logout",
    me: "/api/user/get_me",
    forgotPassword: "/api/user/send_resovery",
    checkRecovery: "/api/user/check_recovery",
  },
  contacts: {
    list: "/api/phonebook/get_contacts",
    add: "/api/phonebook/add_contact",
    edit: "/api/phonebook/edit_contact",
    delete: "/api/phonebook/delete_contact",
    groups: "/api/phonebook/get_groups",
  },
  inbox: {
    chats: "/api/inbox/get_chats",
    messages: "/api/inbox/get_messages",
    send: "/api/inbox/send_message",
  },
  campaigns: {
    list: "/api/broadcast/get_campaigns",
    create: "/api/broadcast/create_campaign",
    cancel: "/api/broadcast/cancel_campaign",
  },
  templates: {
    list: "/api/templet/get_templets",
    metaList: "/api/user/get_my_meta_templets",
    add: "/api/templet/add_templet",
    delete: "/api/templet/del_templet",
  },
  automation: {
    rules: "/api/chatbot/get_rules",
    addRule: "/api/chatbot/add_rule",
    deleteRule: "/api/chatbot/del_rule",
    flows: "/api/chat_flow/get_flows",
  },
  billing: {
    plans: "/api/billing/plans",
    orders: "/api/billing/orders",
    details: "/api/user/get_payment_details",
    calculatePrice: "/api/billing/calculate_price",
    validateCoupon: "/api/billing/validate_coupon",
    createOrder: "/api/billing/create_order",
    verifyPayment: "/api/billing/verify_payment",
  },
  admin: {
    stats: "/api/admin/get_stats",
    users: "/api/admin/get_users",
    plans: "/api/admin/get_plans",
    payments: "/api/admin/get_payments",
  },
  developer: {
    keys: "/api/user/api-keys",
    revokeKey: (id: number | string) => `/api/user/api-keys/${id}`,
    connections: "/api/user/api-keys/connections",
    limits: "/api/user/api-keys/limits",
    stats: "/api/user/api-keys/stats",
  },
  support: {
    tickets: "/api/support/tickets",
    ticketDetail: (id: number | string) => `/api/support/tickets/${id}`,
    reply: (id: number | string) => `/api/support/tickets/${id}/reply`,
    close: (id: number | string) => `/api/support/tickets/${id}/close`,
    adminTickets: "/api/support/admin/tickets",
    adminTicketDetail: (id: number | string) => `/api/support/admin/tickets/${id}`,
    adminReply: (id: number | string) => `/api/support/admin/tickets/${id}/reply`,
    adminStatus: (id: number | string) => `/api/support/admin/tickets/${id}/status`,
  },
};
