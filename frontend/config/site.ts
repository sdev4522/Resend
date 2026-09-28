export interface NavItem {
  title: string;
  href: string;
  icon: string;
  badge?: string;
  external?: boolean;
}

function getCanonicalUrl() {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!envUrl) return "https://wacrm.com";
  if (process.env.NODE_ENV === "production" && envUrl.includes("localhost")) {
    return "https://wacrm.com";
  }
  return envUrl.replace(/\/+$/, "");
}

export const siteConfig = {
  name: "WaCRM",
  description: "Official WhatsApp CRM, Automation & Multi-Agent Inbox",
  url: getCanonicalUrl(),
  contactEmail: "support@wacrm.com",
  mainNav: [
    { title: "Features", href: "/features" },
    { title: "Pricing", href: "/pricing" },
    { title: "Contact", href: "/contact" },
    { title: "FAQ", href: "/#faq" },
  ],
  dashboardNav: [
    { title: "Overview", href: "/dashboard", icon: "LayoutDashboard" },
    { title: "WhatsApp Inbox", href: "/dashboard/inbox", icon: "MessageSquare", badge: "Live" },
    { title: "Contacts", href: "/dashboard/contacts", icon: "Users" },
    { title: "Campaigns", href: "/dashboard/campaigns", icon: "Send" },
    { title: "Templates", href: "/dashboard/templates", icon: "FileText" },
    { title: "Chatbot Rules", href: "/dashboard/automation", icon: "Bot" },
    { title: "Flow Builder", href: "/dashboard/flows", icon: "GitFork" },
    { title: "Analytics", href: "/dashboard/analytics", icon: "BarChart3" },
    { title: "Integrations", href: "/dashboard/integrations", icon: "Plug" },
    { title: "Team / Agents", href: "/dashboard/team", icon: "UserCheck" },
    { title: "Billing & Plans", href: "/dashboard/billing", icon: "CreditCard" },
    { title: "Developer API", href: "/dashboard/developer", icon: "Code2" },
    { title: "Help & Support", href: "/dashboard/support", icon: "LifeBuoy" },
    { title: "Settings", href: "/dashboard/settings", icon: "Settings" },
  ] as NavItem[],
  adminNav: [
    { title: "Admin Overview", href: "/admin", icon: "ShieldAlert" },
    { title: "Customer Support", href: "/admin/support", icon: "LifeBuoy" },
    { title: "Platform Analytics", href: "/admin/analytics", icon: "BarChart3" },
    { title: "User Management", href: "/admin/users", icon: "Users" },
    { title: "Workspaces", href: "/admin/workspaces", icon: "Building2" },
    { title: "WhatsApp Fleet", href: "/admin/whatsapp", icon: "Server" },
    { title: "Subscription Plans", href: "/admin/plans", icon: "Package" },
    { title: "Active Subscriptions", href: "/admin/subscriptions", icon: "CreditCard" },
    { title: "Payment Logs", href: "/admin/payments", icon: "Receipt" },
    { title: "Usage & Limits", href: "/admin/usage", icon: "Gauge" },
    { title: "System Settings", href: "/admin/settings", icon: "Sliders" },
    { title: "Notifications", href: "/admin/notifications", icon: "Bell" },
    { title: "Mail Templates", href: "/admin/mail", icon: "Mail" },
    { title: "Audit & Activity", href: "/admin/audit", icon: "History" },
  ] as NavItem[],
};
