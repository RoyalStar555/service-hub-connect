# Service Hub Connect

Build a premium, ultra-modern React/TypeScript application for "Service Hub", a B2B Commercial Vehicle Roadside Assistance platform. Use Tailwind CSS (Industrial Dark Mode: bg-slate-950), shadcn/ui components, and lucide-react icons. 

I want to use Lovable Cloud (built-in backend) for the database and authentication.

STEP 1: SECURE DATABASE SCHEMA

Set up the Lovable Cloud database with these exact tables and enable real-time subscriptions:

1. `profiles`: id (uuid, refs auth.users), role (text: 'driver', 'mechanic', 'admin'), full_name (text), phone (text), wallet_balance (integer, default 500), is_verified (boolean, default false).

2. `app_settings`: id (uuid), setting_key (text), setting_value (numeric). (Assume a row exists where setting_key = 'unlock_fee' and setting_value = 50).

3. `service_requests`: id (uuid), driver_id (uuid), mechanic_id (uuid, nullable), vehicle_type (text), issue_type (text), exact_lat (float), exact_lng (float), status (text: 'pending', 'accepted', 'completed'), fee_paid (numeric).

STEP 2: MULTILINGUAL CONTEXT (i18n)

- Create a `LanguageContext` supporting English ('en'), Hindi ('hi'), and Marathi ('mr').

- Create a basic translation dictionary for navigation terms.

STEP 3: AUTHENTICATION & MASTER LAYOUT

- Build a polished Login/Signup page. On signup, include a required Role Dropdown: Driver, Mechanic, or Admin.

- Build a sticky Top Navigation Bar containing: A Language Selector Dropdown (EN | HI | MR), the user's Name/Role, and a Logout button.

- Implement Role-Based Routing: After successful login, route drivers to `/driver-dash`, mechanics to `/mechanic-dash`, and admins to `/admin-dash`. Ensure protected routes.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/26bebfab-6d0b-4f34-9f2d-b04e0e14ef75).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
