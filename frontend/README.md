# User Access Management - Frontend

This is the frontend dashboard for the User Access Management system. It is a React application built with Create React App, styled with Tailwind CSS, and uses Shadcn UI components for a clean, modern interface. 

The dashboard allows administrators to view all active and inactive users, search through the directory, and view detailed access permissions for each user. Access permissions are dynamically fetched from the backend API and categorize into "Manual" and "Automated" provisioning tabs.

## Features

- **Dynamic User Directory**: Fetches and lists all users directly from the backend database.
- **Access Control Visualization**: Distinctly separates manual and automated permissions, mapping active services directly to the selected user.
- **Live Search**: Client-side filtering to quickly find users by name or email.
- **Status Indicators**: Visual badges distinguishing between active and offboarded (inactive) users.

## Prerequisites

- **Node.js** (v14 or higher)
- **npm** or **yarn**

## Environment Configuration

Before running the application, you must configure the backend API URL. Create a `.env` file in the root of the `frontend` directory:

```env
REACT_APP_API_URL=http://localhost:5001
```

*(Ensure the backend Node.js server is running on the port specified above).*

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser. The page will reload when you make changes.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance. The build is minified and the filenames include the hashes.

## Technology Stack

- **Framework**: React 18
- **Styling**: Tailwind CSS v3
- **Components**: Shadcn UI (Radix Primitives)
- **Icons**: Lucide React
- **Network**: Native Fetch API
