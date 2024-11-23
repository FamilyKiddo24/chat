// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyA4swkkixyBVSrbgJmz69cZSimUGDjNk1k",
    authDomain: "hufflepuff-chat.firebaseapp.com",
    projectId: "hufflepuff-chat",
    storageBucket: "hufflepuff-chat.appspot.com",
    messagingSenderId: "638964166645",
    appId: "1:638964166645:web:9a0b19613a6eb016fcfabc"
};

firebase.initializeApp(firebaseConfig);

// Auth functions
const auth = firebase.auth();
const db = firebase.firestore();

// Sign Up
document.getElementById('signupForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (username.length < 3) {
        alert('Username must be at least 3 characters long');
        return;
    }

    try {
        // Check if username already exists
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('username', '==', username).get();
        if (!snapshot.empty) {
            throw new Error('Username already taken');
        }

        // Create user
        const userCredential = await auth.createUserWithEmailAndPassword(`${username}@hufflepuff.chat`, password);
        
        // Add user to Firestore
        await db.collection('users').doc(userCredential.user.uid).set({
            username: username,
            profilePicture: username.charAt(0).toUpperCase(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        window.location.href = 'chat.html';
    } catch (error) {
        alert(error.message);
    }
});

// Login
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const userCredential = await auth.signInWithEmailAndPassword(`${username}@hufflepuff.chat`, password);
        
        // Verify user data exists in Firestore
        const userDoc = await db.collection('users').doc(userCredential.user.uid).get();
        if (!userDoc.exists) {
            // Create user data if it doesn't exist
            await db.collection('users').doc(userCredential.user.uid).set({
                username: username,
                profilePicture: username.charAt(0).toUpperCase(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        window.location.href = 'chat.html';
    } catch (error) {
        alert(error.message);
    }
});

// Check auth state
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // Check if user data exists in Firestore
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists) {
            // Get username from email
            const username = user.email.split('@')[0];
            // Create user data
            await db.collection('users').doc(user.uid).set({
                username: username,
                profilePicture: username.charAt(0).toUpperCase(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        if (window.location.pathname.includes('index.html') || 
            window.location.pathname.includes('signup.html')) {
            window.location.href = 'chat.html';
        }
    } else {
        if (!window.location.pathname.includes('index.html') && 
            !window.location.pathname.includes('signup.html')) {
            window.location.href = 'index.html';
        }
    }
}); 