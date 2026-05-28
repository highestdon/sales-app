# Ghana Jewelry Sales Tracker

A modern progressive web app for managing jewelry and accessories sales in Ghana. The app uses HTML, CSS, vanilla JavaScript, Firebase Authentication, and Firebase Realtime Database.

## Project files

- `index.html` - single page app shell and UI layout
- `style.css` - responsive modern styling
- `firebase.js` - Firebase initialization
- `auth.js` - login, role control, and app orchestration
- `products.js` - product listing, product editing, and product management
- `sales.js` - record pending sales and device tracking
- `approvals.js` - manager approval queue and reject/approve workflow
- `audit.js` - immutable audit logging for every important action
- `dashboard.js` - approved revenue analytics, commission reports, and sales history
- `manifest.json` - PWA metadata
- `service-worker.js` - offline shell caching
- `icons/icon-192.svg` - app icon
- `icons/icon-512.svg` - app icon

## Firebase setup

1. Open the Firebase console and create a new project.
2. Enable **Authentication** > **Sign-in method**:
   - Email/Password
   - Google
3. Enable **Realtime Database** and set it to **start in locked mode**.
4. Copy the Firebase config values and paste them into `firebase.js`.
   - Replace `YOUR_API_KEY`, `YOUR_PROJECT_ID`, `YOUR_SENDER_ID`, `YOUR_APP_ID`.
5. Add the following Realtime Database data structure manually under `users`:

```json
{
  "users": {
    "manager1": {
      "name": "Nathaniel",
      "email": "nathanielduodu27@gmail.com",
      "role": "manager"
    },
    "rep1": {
      "name": "Prince",
      "email": "prince@gmail.com",
      "role": "rep"
    }
  }
}
```

## Realtime Database rules

Use these rules in the Firebase console or deploy `database.rules.json` to secure the data. The updated rules ensure:
- Sales can be created by rep only as pending
- Managers can approve or reject sales
- Audit logs are write-only and visible only to managers
- Products are managed only by managers

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": false,
    "users": {
      "$userId": {
        ".read": "auth != null && (auth.uid === $userId || root.child('users').child(auth.uid).child('role').val() === 'manager' || data.child('email').val() === auth.token.email)",
        ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'manager'"
      }
    },
    "products": {
      ".read": "auth != null",
      "$productId": {
        ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'manager'"
      }
    },
    "sales": {
      ".read": "auth != null",
      "$saleId": {
        ".read": "auth != null && (data.child('userEmail').val() === auth.token.email || root.child('users').child(auth.uid).child('role').val() === 'manager')",
        ".write": "auth != null && (
          (!data.exists() &&
            newData.child('status').val() === 'pending' &&
            newData.child('userEmail').val() === auth.token.email &&
            newData.child('createdByUid').val() === auth.uid &&
            newData.child('approvedAt').val() === null &&
            newData.child('rejectedAt').val() === null
          ) ||
          root.child('users').child(auth.uid).child('role').val() === 'manager' ||
          (data.exists() &&
            data.child('userEmail').val() === auth.token.email &&
            data.child('status').val() === 'pending' &&
            data.child('createdAt').val() >= (now - 600000) &&
            newData.child('status').val() === data.child('status').val()
          )
        )",
        ".validate": "newData.hasChildren(['productId','productName','quantity','price','total','userEmail','status','createdAt','deviceInfo'])"
      }
    },
    "auditLogs": {
      ".read": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'manager'",
      "$logId": {
        ".write": "auth != null && !data.exists()",
        ".validate": "newData.hasChildren(['action','performedBy','timestamp','details'])"
      }
    }
  }
}
```

> For a full production deployment, tighten rules by verifying authenticated user roles and uid matching.

## Authentication setup steps

1. In Firebase Authentication, create user accounts for reps and manager.
2. Use the same email addresses that exist in the Realtime Database `users` node.
3. Create secure passwords for each user.
4. Reps and manager should sign in using the login form or Google.
5. When a Google user signs in, the app matches the user by email to their role in the Realtime Database.

## Running locally

1. Open `index.html` in a browser or serve the folder with a local web server.
2. Install the PWA by opening the page on mobile or desktop and using the browser install option.
3. The app cache works for the shell when offline.

## Notes

- Managers can add products, view all sales, and see commission/revenue reports.
- Reps can select products, enter quantities, and record sales.
- Product stock is updated automatically after a sale.
- Products can be filtered by category and track cost/profit margins.
- Dark/light theme toggle is available for the entire dashboard.
- Weekly commission is calculated using Monday-based weeks.
