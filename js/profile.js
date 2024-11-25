const updateProfileForm = document.getElementById('updateProfileForm');
const profilePicture = document.getElementById('profilePicture');
const recentMessages = document.getElementById('recentMessages');

// Load user data
async function loadUserData() {
    try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.data();
        
        if (!userData) {
            throw new Error('User data not found');
        }
        
        // Always show first letter
        profilePicture.textContent = userData.username.charAt(0).toUpperCase();
        document.getElementById('newUsername').value = userData.username || '';
    } catch (error) {
        console.error('Error loading user data:', error);
        alert('Error loading user data. Please try refreshing the page.');
    }
}

// Load recent messages
function loadRecentMessages() {
    if (!auth.currentUser) return;

    db.collection('messages')
        .where('userId', '==', auth.currentUser.uid)
        .orderBy('timestamp', 'desc')
        .limit(10)
        .onSnapshot((snapshot) => {
            recentMessages.innerHTML = '';
            snapshot.forEach(doc => {
                const message = doc.data();
                const messageElement = document.createElement('div');
                messageElement.className = 'message';
                messageElement.innerHTML = `
                    <p>${message.text}</p>
                    <small>${message.timestamp?.toDate().toLocaleString() || 'Just now'}</small>
                `;
                recentMessages.appendChild(messageElement);
            });
        }, error => {
            console.error('Error loading recent messages:', error);
        });
}

// Update profile
updateProfileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newUsername = document.getElementById('newUsername').value.trim();
    
    if (!newUsername) {
        alert('Username cannot be empty');
        return;
    }
    
    try {
        // Update user document
        await db.collection('users').doc(auth.currentUser.uid).update({
            username: newUsername,
            profilePicture: newUsername.charAt(0).toUpperCase()
        });
        
        // Update all messages with new username
        const messagesQuery = await db.collection('messages')
            .where('userId', '==', auth.currentUser.uid)
            .get();
            
        const batch = db.batch();
        messagesQuery.docs.forEach(doc => {
            const messageRef = db.collection('messages').doc(doc.id);
            batch.update(messageRef, {
                username: newUsername,
                profilePicture: newUsername.charAt(0).toUpperCase()
            });
        });
        await batch.commit();
        
        alert('Profile updated successfully!');
        loadUserData();
    } catch (error) {
        console.error('Error updating profile:', error);
        alert(error.message || 'Error updating profile. Please try again.');
    }
});

// Wait for authentication before loading data
auth.onAuthStateChanged((user) => {
    if (user) {
        loadUserData();
        loadRecentMessages();
    } else {
        window.location.href = 'index.html';
    }
}); 