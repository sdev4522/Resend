# WACRM SaaS — Design System & UX Specification

## 0. Document purpose

This is the visual and interaction source of truth for the product.

The product is a B2B WhatsApp SaaS. It must feel like one product across:
- Marketing website
- Authentication
- Onboarding
- User dashboard
- Inbox
- Automation
- Billing
- Checkout
- Admin panel
- Mobile web experience

Do not treat copied blocks as finished design. Blocks are raw building material and must be adapted into the product's design system.

Official shadcn/ui should be the primary UI foundation. Use the official shadcn CLI/components and keep components inside the project so they can be customized. The official docs currently recommend `shadcn/create` or the CLI for new projects and list Next.js as a supported template. https://ui.shadcn.com/docs/installation

Use shadcn/ui Blocks as secondary building material for sections and screens. The Blocks collection currently provides categories such as authentication, pricing, login, signup, stats, team, profile, navbar and empty states. https://www.shadcnui-blocks.com/blocks

---

# 1. Product design principles

1. Consistency over novelty.
2. Business workflows over decoration.
3. Mobile usability is a first-class requirement, not a later responsive pass.
4. Every important action must have clear feedback.
5. Limits and billing state must be visible without being annoying.
6. Destructive actions require confirmation.
7. Empty, loading, error, disabled and permission-denied states are designed explicitly.
8. Never hide important SaaS restrictions behind vague errors.
9. Accessibility and keyboard navigation are required.
10. Prefer existing shadcn primitives over creating duplicate primitives.

---

# 2. Visual direction

Target feel:
- Modern B2B SaaS
- Clean
- Professional
- Information-dense where useful
- Calm visual hierarchy
- Strong typography
- Subtle borders and shadows
- Restrained use of color
- Fast-feeling UI

Avoid:
- Excessive glassmorphism
- Random gradients
- Huge dashboard headings
- Excessive rounded containers
- Multiple visual styles copied from unrelated blocks
- Decorative animation that slows workflows
- Color being the only indicator of status

---

# 3. Design tokens

Use CSS variables/design tokens through the shadcn theme.

Required semantic tokens:
- background
- foreground
- card
- card-foreground
- popover
- popover-foreground
- primary
- primary-foreground
- secondary
- secondary-foreground
- muted
- muted-foreground
- accent
- accent-foreground
- destructive
- destructive-foreground
- border
- input
- ring

Additional product status tokens:
- success
- warning
- info
- pending
- danger

Never scatter raw hex colors through application components.

---

# 4. Typography

Use one primary font family throughout the product.

Hierarchy:
- Marketing display
- Marketing H1/H2/H3
- Dashboard page title
- Section title
- Card title
- Body
- Label
- Helper text
- Caption
- Code/technical text

Dashboard typography should be compact enough for dense operational screens.

---

# 5. Layout system

## Marketing

Use a centered responsive container with consistent max width.

Typical structure:
- Navbar
- Hero
- Product proof/demo
- Feature sections
- Integrations
- Pricing
- FAQ
- CTA
- Footer

## Dashboard desktop

Use:
- Persistent sidebar
- Top header
- Main content area
- Optional contextual right panel

Sidebar must collapse on smaller screens.

## Dashboard mobile

Do NOT simply shrink desktop UI.

Use:
- Mobile header
- Sheet/drawer navigation
- Bottom navigation only for high-frequency destinations where useful
- Full-width primary actions
- Horizontally scrollable tabs when necessary
- Stacked cards
- Drawer/sheet for secondary information
- Dedicated mobile inbox layout

---

# 6. Mobile-first rules

Mobile target widths must be treated as real product layouts.

Required:
- Touch targets approximately 44px or larger
- No critical horizontal overflow
- Tables become cards, lists, or horizontally scrollable regions when appropriate
- Sidebar becomes Sheet/Drawer
- Multi-column forms become one column
- Modals become mobile-friendly sheets where appropriate
- Important actions remain reachable with one hand
- Chat composer remains usable above the mobile keyboard
- Filters move into a filter sheet
- Dense admin tables provide mobile alternatives

Never solve mobile by:
- reducing font size until unreadable
- squeezing five columns into 360px
- hiding essential actions
- requiring desktop hover interactions

---

# 7. Component system

Use official shadcn/ui components whenever applicable:
- Button
- Card
- Badge
- Alert
- Alert Dialog
- Dialog
- Sheet
- Drawer
- Dropdown Menu
- Command
- Select
- Combobox
- Input
- Textarea
- Form
- Checkbox
- Radio Group
- Switch
- Tabs
- Table
- Data Table
- Pagination
- Calendar
- Date Picker
- Popover
- Tooltip
- Sidebar
- Breadcrumb
- Skeleton
- Progress
- Empty
- Spinner
- Toast/Sonner

Create product-specific components on top of these primitives.

Examples:
- PlanBadge
- UsageMeter
- LimitBanner
- UpgradePrompt
- BillingStatus
- CheckoutSummary
- WhatsAppConnectionCard
- ConversationList
- MessageComposer
- CampaignStatusBadge
- AutomationStatus
- PermissionGate

---

# 8. SaaS-specific UX

SaaS limitations must be visible and understandable.

Every metered feature should have:
- Current usage
- Plan limit
- Remaining amount where meaningful
- Reset period
- Upgrade path

Example:
"8,420 / 10,000 messages used this month"

Do not simply show:
"Limit exceeded"

Instead explain:
- What limit was reached
- Current usage
- Allowed limit
- When it resets
- What upgrading changes

Use:
- Inline usage meters
- Dashboard usage cards
- Contextual upgrade prompts
- Billing page
- Optional warning banners near limits

Do not spam upgrade prompts.

---

# 9. Plan display

Pricing cards must show:
- Plan name
- Price
- Billing period
- Key included capabilities
- Usage limits
- Team/user limits
- WhatsApp/account limits
- Automation/feature limits
- CTA
- Current-plan state when logged in

Plan comparison must avoid ambiguous wording.

Prefer:
"10,000 messages/month"

over:
"High message limit"

---

# 10. Checkout UX

Razorpay is the only payment gateway initially.

Design checkout as a complete state machine:

1. Plan selected
2. Checkout initialized
3. Payment UI opened
4. Payment processing
5. Payment success
6. Payment failed
7. Payment cancelled
8. Verification pending
9. Verification failed
10. Subscription activated
11. Subscription activation delayed/error

Never show "Payment successful" merely because the Razorpay UI closed.

The frontend must ultimately rely on backend verification.

Checkout page should show:
- Selected plan
- Billing cycle
- Price
- Applicable taxes/fees if configured
- Final payable amount
- Existing subscription state
- Payment status
- Support/retry path

Never expose Razorpay secret credentials in the frontend.

---

# 11. Billing UX

Billing screen should contain:

## Current plan
- Plan
- Status
- Renewal date
- Billing cycle
- Price

## Usage
- Messages
- Contacts
- Team members
- WhatsApp accounts
- Campaigns
- Automations
- Other metered resources

## Subscription actions
- Upgrade
- Downgrade
- Cancel
- Renew/reactivate if supported

## Payment history
- Invoice/payment ID
- Amount
- Date
- Status
- Receipt/download where backend supports it

---

# 12. Inbox design

Desktop:
- Conversation list
- Conversation view
- Contact/context panel

Mobile:
- Conversation list screen
- Tap conversation → full conversation screen
- Back navigation
- Composer fixed to usable viewport
- Attachment/action menu in Sheet/Popover

Inbox must support:
- Search
- Unread
- Assignment
- Labels
- Status
- Contact info
- Media
- Templates
- Reply
- Delivery/read state where backend provides it

---

# 13. Forms

All important forms require:
- Label
- Clear field state
- Validation
- Error message
- Loading state
- Success feedback
- Disabled state
- Keyboard accessibility

Never rely only on toast messages for field validation.

---

# 14. Loading states

Use Skeleton for content-heavy areas.

Do not show a full-page spinner when only one section is loading.

Prefer:
- Table skeleton
- Card skeleton
- Conversation skeleton
- Form loading state
- Button spinner

---

# 15. Empty states

Every list page must have an intentional empty state.

Include:
- What is empty
- Why it may be empty
- Primary action
- Optional secondary action

Examples:
"No campaigns yet"
"Create your first campaign"

---

# 16. Error states

Errors must distinguish:
- Validation error
- Authentication error
- Permission error
- Network error
- Backend error
- Payment error
- Rate/usage limit
- WhatsApp connection error

Never display raw backend stack traces to users.

---

# 17. Accessibility

Required:
- Keyboard navigation
- Visible focus states
- Semantic HTML
- Accessible labels
- Dialog focus management
- Sufficient contrast
- Screen-reader-friendly status messages
- No hover-only critical actions

---

# 18. Animation

Use animation sparingly.

Allowed:
- Page/section entrance
- Dialog/sheet transitions
- Button loading
- Toast
- Sidebar transitions
- Small state changes

Avoid:
- Long page transitions
- Excessive parallax
- Animation on every card
- Animation that blocks interaction

---

# 19. Design consistency rule

Before creating a new component ask:

1. Does shadcn already provide it?
2. Does an existing product component already solve it?
3. Can an existing component be extended?
4. Is the new component genuinely reusable?

Do not create duplicate Button/Card/Dialog/Table systems.

---

# 20. Design acceptance criteria

A screen is not complete until:
- Desktop is usable
- Mobile is usable
- Loading state exists
- Empty state exists
- Error state exists
- Permission/disabled state exists where applicable
- SaaS limit state exists where applicable
- Keyboard interaction works
- Visual tokens are consistent
- No raw API data leaks into presentation
