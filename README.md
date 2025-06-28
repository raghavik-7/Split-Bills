# Split Bills

Split Bills is a modern, full-stack web application designed to simplify expense tracking and bill splitting among friends, family, and groups. It features an intuitive user interface and a powerful AI assistant that allows users to add expenses using natural language commands.

## ✨ Key Features

- **User Authentication**: Secure sign-up and sign-in functionality using Clerk.
- **Group Management**: Create and manage groups to track shared expenses.
- **Expense Tracking**: Add, view, and manage expenses with detailed information.
- **AI-Powered Expense Creation**: Use natural language to quickly add expenses (e.g., "I paid $50 for dinner with Alex and Bob").
- **Real-time Balance Summary**: A dashboard that provides a clear overview of who owes whom.
- **Debt Settlement**: Easily record and track settlements between users.
- **Background Job Processing**: Uses Inngest for asynchronous tasks like sending notifications.
- **Email Notifications**: Integration with Resend for sending emails.

## 🚀 Tech Stack

- **Framework**: [Next.js](https://nextjs.org/)
- **Backend & Database**: [Convex](https://www.convex.dev/)
- **Authentication**: [Clerk](https://clerk.com/)
- **AI**: [Ollama](https://ollama.com/) with the Mistral model for natural language processing.
- **UI**:
  - [React](https://react.dev/)
  - [Tailwind CSS](https://tailwindcss.com/)
  - [shadcn/ui](https://ui.shadcn.com/) for UI components.
  - [Recharts](https://recharts.org/) for data visualization.
- **Background Jobs**: [Inngest](https://www.inngest.com/)
- **Email Service**: [Resend](https://resend.com/)
- **Form Management**: [React Hook Form](https://react-hook-form.com/) & [Zod](https://zod.dev/)

## 🏁 Getting Started

Follow these instructions to set up and run the project locally.

### Prerequisites

- [Node.js](https://nodejs.org/en) (v18 or later)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Git](https://git-scm.com/)
- [Ollama](https://ollama.com/) installed and running on your local machine.

### 1. Clone the Repository

```bash
git clone <repository-url>
cd split-bills
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env.local` file in the root of the project and add the following environment variables.

```
# Convex
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Email (Resend)
RESEND_API_KEY=

# Google Gemini
GEMINI_API_KEY=
```
