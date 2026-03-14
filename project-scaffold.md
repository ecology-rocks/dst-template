# Project Context: DogSportTees & Indie POD Platform

## 1. Project Overview

This project is a multi-phased e-commerce and catalog management web application. It aims to solve the severe catalog management bottleneck faced by digital artists (especially in the wake of Etsy fee hikes and the closure of platforms like GoImagine).

The platform allows artists to define reusable product "Blanks" (e.g., a specific hoodie in three colors) and map a single design to all variants automatically. It also supports complex user customizations (e.g., swappable graphic elements like dog breeds, and custom text inputs).

**Phased Roadmap:**

* **Phase 1 (Internal MVP):** A single-tenant catalog management tool for the domain `DogSportTees`. Focuses strictly on data architecture, mapping designs to Blanks, and auto-generating mockups.
* **Phase 2 (Customization):** Adding frontend canvas layering for swappable elements (e.g., choosing from 30 dog breeds) and text inputs, parsing this into an order payload, and flattening the final print file via the backend.
* **Phase 3 (E-commerce & Fulfillment):** Integrating standard Stripe Checkout and routing paid orders either to a POD API (Printify/Printful) or an internal self-fulfillment queue.
* **Phase 4 (Multi-Tenant Platform):** Opening the platform to other indie artists. Includes dynamic storefront routing (`/shops/artist-name`), artist admin dashboards, and Stripe Connect for split payouts.

## 2. Tech Stack & Architecture

* **Frontend:** [Insert your preferred framework here, e.g., React/Vue/Svelte]
* **Backend / Auth / Database:** Firebase (Authentication, Firestore, Cloud Functions)
* **Hosting:** Firebase Hosting
* **Payments:** Stripe (Checkout for Phase 1-3; Stripe Connect for Phase 4)
* **Fulfillment API:** Printify / Printful APIs (for routed POD orders)

## 3. High-Level Directory Structure

```text
/
├── frontend/                 # UI, state management, and asset canvas
│   ├── src/
│   │   ├── components/       # Reusable UI (Buttons, Modals)
│   │   ├── pages/            # Views (Storefront, Product Detail, Admin Dashboard)
│   │   ├── services/         # Firebase/Stripe/API client wrappers
│   │   └── utils/            # Image processing/canvas helpers
├── functions/                # Firebase Cloud Functions (Node.js)
│   ├── src/
│   │   ├── api/              # POD API integrations
│   │   ├── auth/             # User creation hooks
│   │   ├── imageProcessing/  # Image flattening/composition for print files
│   │   ├── stripe/           # Webhooks and Checkout session creation
│   │   └── index.js          # Entry point
├── firestore.rules           # Database security rules
└── firebase.json             # Firebase configuration

```

## 4. AI Assistant Directives (Strict Workflow Rules)

As my AI pair programmer, you must adhere strictly to the following instructions:

* **Role & Tone:** Act as a senior full-stack engineer. Be realistic, straightforward, and friendly. Avoid toxic positivity. Do not over-explain basic web development concepts unless I ask. I have experience building and managing full-stack applications; treat me as a capable peer.
* **Code Generation Protocol:** * **First Drafts:** When we start a new file or a brand new feature, provide the complete, fully functional first draft of the code.
* **Iterations & Edits (CRITICAL):** After the initial draft, **do not** rewrite or output the entire file. I frequently change variable names and file locations on my end. For updates, you must only provide the specific code snippets that need to be replaced, added, or deleted.
* **No Unprompted Refactoring:** Never replace my code with a "reimagining" of the architecture or logic unless I explicitly ask you for a refactor or alternative approach.


* **Problem Solving:** If we hit a wall with Firebase limits or Stripe Connect compliance, tell me the hard truth and propose the most pragmatic workaround.
