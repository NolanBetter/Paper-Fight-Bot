/* Firebase, in one place. Everything else imports from here.

   These keys are meant to be public. They name the project, they do not grant
   access to it. What people can actually read and write is decided by the
   rules in firestore.rules, which live on Google's side and cannot be edited
   from the browser. */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDHFEiYuEYY0Rw29gleoFVAyZ-Pyg68EMc",
  authDomain: "pfbwebsite-45ce2.firebaseapp.com",
  projectId: "pfbwebsite-45ce2",
  storageBucket: "pfbwebsite-45ce2.firebasestorage.app",
  messagingSenderId: "484922895913",
  appId: "1:484922895913:web:676aae5968db9a5db8f638",
  measurementId: "G-R9MFH7ZZ3H"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/* Analytics is left out on purpose. It pulls another SDK on every page load
   and this site has nothing to measure. If you want it back:

     import { getAnalytics } from ".../firebase-analytics.js";
     export const analytics = getAnalytics(app);
*/
