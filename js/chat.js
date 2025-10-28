console.log('Chat.js loaded');

const messagesDiv = document.getElementById('messages');
const messageForm = document.getElementById('messageForm');
const logoutBtn = document.getElementById('logoutBtn');
const imageInput = document.getElementById('imageInput');
const addImageBtn = document.getElementById('addImageBtn');
const selectedImageName = document.getElementById('selectedImageName');
const messageInput = document.getElementById('messageInput');
let notificationPermission = false;
// Admin user ids (add more UIDs to this array to grant admin rights)
const ADMIN_UIDS = [
    'p01RisIcRYX8avIDrCisaRT1bSC2',
    'r7O5Blm2hqQSNPeFfRuoIzd7yDJ2'
];

function isAdmin(uid) {
    return ADMIN_UIDS.includes(uid);
}
let muteUnsubscribe = null;
let muteInterval = null;
let muteBanner = null;

function getMillisFromTimestamp(ts) {
    if (!ts) return null;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (ts.seconds) return ts.seconds * 1000;
    if (typeof ts === 'number') return ts;
    if (ts instanceof Date) return ts.getTime();
    return null;
}

function formatRemaining(ms) {
    if (ms <= 0) return '0s';
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

function enableInputs(enabled) {
    try {
        messageInput.disabled = !enabled;
        imageInput.disabled = !enabled;
        addImageBtn.disabled = !enabled;
        const submitBtn = messageForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = !enabled;
    } catch (e) {
        console.warn('Error toggling inputs', e);
    }
}

function showMuteBanner(remainingMs) {
    if (!muteBanner) {
        muteBanner = document.createElement('div');
        muteBanner.id = 'muteBanner';
        muteBanner.style.background = 'rgba(255,69,0,0.12)';
        muteBanner.style.color = 'var(--hufflepuff-yellow)';
        muteBanner.style.padding = '8px 12px';
        muteBanner.style.border = '1px solid rgba(255,69,0,0.2)';
        muteBanner.style.borderRadius = '6px';
        muteBanner.style.marginBottom = '8px';
        muteBanner.style.fontSize = '0.95rem';
        const container = document.querySelector('.chat-container') || document.body;
        container.insertBefore(muteBanner, container.firstChild);
    }
    muteBanner.textContent = `You are muted for ${formatRemaining(remainingMs)}.`;
}

function removeMuteBanner() {
    if (muteBanner && muteBanner.parentNode) {
        muteBanner.parentNode.removeChild(muteBanner);
        muteBanner = null;
    }
}

function updateMuteUI(mutedUntil) {
    // Clear any existing interval
    if (muteInterval) {
        clearInterval(muteInterval);
        muteInterval = null;
    }

    const ms = getMillisFromTimestamp(mutedUntil);
    if (ms && ms > Date.now()) {
        // User is muted
        enableInputs(false);
        const remaining = ms - Date.now();
        showMuteBanner(remaining);

        // Update countdown every second
        muteInterval = setInterval(() => {
            const now = Date.now();
            const rem = ms - now;
            if (rem <= 0) {
                clearInterval(muteInterval);
                muteInterval = null;
                enableInputs(true);
                removeMuteBanner();
            } else {
                showMuteBanner(rem);
            }
        }, 1000);
    } else {
        // Not muted
        enableInputs(true);
        removeMuteBanner();
    }
}

function setupMuteListener() {
    // Clean up previous listener
    if (muteUnsubscribe) {
        muteUnsubscribe();
        muteUnsubscribe = null;
    }
    if (!auth.currentUser) return;
    const ref = db.collection('users').doc(auth.currentUser.uid);
    muteUnsubscribe = ref.onSnapshot(doc => {
        const data = doc.exists ? doc.data() : {};
        updateMuteUI(data.mutedUntil);
    }, err => {
        console.error('Mute listener error', err);
    });
}

function cleanupMuteListener() {
    if (muteUnsubscribe) {
        muteUnsubscribe();
        muteUnsubscribe = null;
    }
    if (muteInterval) {
        clearInterval(muteInterval);
        muteInterval = null;
    }
    removeMuteBanner();
}

// Add this function to request notification permission
async function requestNotificationPermission() {
    try {
        const permission = await Notification.requestPermission();
        notificationPermission = permission === 'granted';
    } catch (error) {
        console.error('Error requesting notification permission:', error);
    }
}

// Add this function to show notifications
function showNotification(username, message) {
    if (notificationPermission && document.hidden) {
        const notification = new Notification(username, {
            body: message,
            icon: '/favicon.ico'
        });

        // Auto close notification after 4 seconds
        setTimeout(() => notification.close(), 4000);
    }
}

// Handle image button click
addImageBtn.addEventListener('click', () => {
    console.log('Image button clicked');
    imageInput.click();
});

// Add this function to compress the image
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onerror = (err) => reject(err);

        // If GIF, preserve original data URL to keep animation
        if (file.type === 'image/gif') {
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
            return;
        }

        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions while maintaining aspect ratio
                if (width > height) {
                    if (width > 800) {
                        height *= 800 / width;
                        width = 800;
                    }
                } else {
                    if (height > 800) {
                        width *= 800 / height;
                        height = 800;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Compress to JPEG with 0.7 quality
                try {
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(dataUrl);
                } catch (err) {
                    // Fallback: return original if canvas fails
                    resolve(e.target.result);
                }
            };
            img.onerror = (err) => reject(err);
        };

        reader.readAsDataURL(file);
    });
}

// Handle image selection
imageInput.addEventListener('change', async (e) => {
    console.log('Image selected');
    const file = e.target.files[0];
    if (file) {
        console.log('File size:', file.size);
        if (file.size > 5 * 1024 * 1024) {
            alert('Image must be less than 5MB');
            imageInput.value = '';
            selectedImageName.textContent = 'Select an image';
            return;
        }
        
        // Check for specific image types
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            alert('Only JPG, PNG, and GIF images are allowed');
            imageInput.value = '';
            selectedImageName.textContent = 'Select an image';
            return;
        }
        selectedImageName.textContent = file.name;
    } else {
        selectedImageName.textContent = 'Select an image';
    }
});

// Send message
messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('Sending message');
    const text = messageInput.value.trim();
    const imageFile = imageInput.files[0];
    
    // Check if either message or image is present
    if (!text && !imageFile) {
        alert('Please enter a message or select an image');
        return;
    }

    if (text.length > 500) {
        alert('Message must be less than 500 characters');
        return;
    }

    try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.data();
        
        if (!userData) {
            throw new Error('User data not found');
        }
        // Check if user is muted
        if (userData.mutedUntil && userData.mutedUntil.toMillis && userData.mutedUntil.toMillis() > Date.now()) {
            const remainingMs = userData.mutedUntil.toMillis() - Date.now();
            const remainingSeconds = Math.ceil(remainingMs / 1000);
            alert(`You are muted for another ${remainingSeconds} second(s). You cannot send messages right now.`);
            return;
        }
        
        let image = null;
        if (imageFile) {
            // Compress image before converting to base64
            image = await compressImage(imageFile);
        }
        
        // Create message document
        await db.collection('messages').add({
            text: text || null,
            image: image, // Compressed base64 string
            userId: auth.currentUser.uid,
            username: userData.username,
            profilePicture: userData.username.charAt(0).toUpperCase(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Clear inputs
        messageInput.value = '';
        imageInput.value = '';
        selectedImageName.textContent = 'Select an image';
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Error sending message. Please try again. If using an image make sure it is smaller than 1MB.');
    }
});

// Load messages
function loadMessages() {
    let isFirstLoad = true;
    
    db.collection('messages')
        .orderBy('timestamp', 'desc')
        .limit(100)
        .onSnapshot((snapshot) => {
            messagesDiv.innerHTML = '';
            const currentUid = auth.currentUser ? auth.currentUser.uid : null;
            
            // Check for new messages
            if (!isFirstLoad) {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const message = change.doc.data();
                        // Don't notify for own messages
                        if (message.userId !== auth.currentUser.uid) {
                            const notificationText = message.text || 'Shared an image';
                            showNotification(message.username, notificationText);
                        }
                    }
                });
            }
            
            snapshot.docs.reverse().forEach(doc => {
                const message = doc.data();
                const messageElement = document.createElement('div');
                messageElement.className = `message ${message.userId === auth.currentUser.uid ? 'own' : ''}`;
                
                // Only show timestamp if it exists and has seconds
                let timestampHTML = '';
                if (message.timestamp && message.timestamp.seconds) {
                    const date = new Date(message.timestamp.seconds * 1000);
                    timestampHTML = `<small class="timestamp">${date.toLocaleString()}</small>`;
                }
                
                // Check if profilePicture exists, otherwise use username's first letter
                const profilePic = message.profilePicture 
                    ? `<div class="message-profile-pic">${message.profilePicture}</div>`
                    : message.username 
                        ? `<div class="message-profile-pic">${message.username.charAt(0).toUpperCase()}</div>`
                        : `<div class="message-profile-pic">?</div>`;
                
                const imageContent = message.image 
                    ? `<img src="${message.image}" alt="Shared image" loading="lazy">` 
                    : '';

                // Determine if current user can delete (own message or admin)
                const canDelete = message.userId === currentUid || isAdmin(currentUid);

                // Owner delete button remains visible. Admin-only controls are placed in a hidden container
                // that will be shown when the message element receives focus or hover.
                const messageHTML = `
                    ${canDelete ? '<span class="delete-message" data-id="' + doc.id + '">×</span>' : ''}
                    ${profilePic}
                    <div class="message-content">
                        <strong>${message.username || 'Unknown User'}</strong>
                        ${imageContent}
                        ${message.text ? `<p>${message.text}</p>` : ''}
                        ${timestampHTML}
                    </div>
                    ${isAdmin(currentUid) ? '<div class="admin-controls">' +
                        '<span class="admin-delete" data-id="' + doc.id + '">🗑</span>' +
                        '<span class="change-username" data-userid="' + message.userId + '">✎</span>' +
                        '<span class="mute-user" data-userid="' + message.userId + '">🔇</span>' +
                        '</div>' : ''}
                `;

                messageElement.innerHTML = messageHTML;
                // Make each message focusable so keyboard users can focus it to reveal admin controls
                messageElement.tabIndex = 0;
                messagesDiv.appendChild(messageElement);

                // If current user is admin, wire focus/hover to show/hide admin controls
                if (isAdmin(currentUid)) {
                    const adminControls = messageElement.querySelector('.admin-controls');
                    if (adminControls) {
                        const show = () => adminControls.classList.add('visible');
                        const hide = () => adminControls.classList.remove('visible');

                        // Show on focus or hover, hide on blur or mouse leave
                        messageElement.addEventListener('focus', show);
                        messageElement.addEventListener('blur', hide);
                        messageElement.addEventListener('mouseenter', show);
                        messageElement.addEventListener('mouseleave', hide);

                        // Make the control buttons keyboard-focusable
                        adminControls.querySelectorAll('span').forEach(s => s.tabIndex = 0);

                        // Update mute button label based on user's current muted state
                        const muteBtn = adminControls.querySelector('.mute-user');
                        if (muteBtn) {
                            (async () => {
                                try {
                                    const ud = await db.collection('users').doc(message.userId).get();
                                    if (!ud.exists) return;
                                    const udata = ud.data();
                                    const mutedMs = getMillisFromTimestamp(udata && udata.mutedUntil);
                                    if (mutedMs && mutedMs > Date.now()) {
                                        // currently muted -> show unmute icon
                                        muteBtn.textContent = '🔊';
                                        muteBtn.title = 'Unmute user';
                                        muteBtn.dataset.muted = '1';
                                    } else {
                                        // not muted -> show mute icon
                                        muteBtn.textContent = '🔇';
                                        muteBtn.title = 'Mute user for 10 minutes';
                                        delete muteBtn.dataset.muted;
                                    }
                                } catch (err) {
                                    console.error('Error getting user mute state', err);
                                }
                            })();
                        }
                    }
                }
            });
            
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            isFirstLoad = false;
        });
}

// Delete message
messagesDiv.addEventListener('click', async (e) => {
    // Delete message (allowed for own messages or admin - UI controls determine visibility)
    if (e.target.classList.contains('delete-message')) {
        try {
            const messageId = e.target.dataset.id;
            await db.collection('messages').doc(messageId).delete();
        } catch (error) {
            console.error('Error deleting message:', error);
            alert('Error deleting message. Please try again.');
        }
        return;
    }

    // Change username (admin only)
    if (e.target.classList.contains('change-username')) {
        const targetUid = e.target.dataset.userid;
        const newName = prompt('Enter new username (min 3 characters):');
        if (!newName) return;
        if (newName.trim().length < 3) {
            alert('Username must be at least 3 characters long');
            return;
        }

        try {
            // Check uniqueness (exclude the target user's current username)
            const usersRef = db.collection('users');
            const existing = await usersRef.where('username', '==', newName.trim()).get();
            if (!existing.empty) {
                // If only one exists and it's the same user, it's okay
                const isSameUser = existing.docs.length === 1 && existing.docs[0].id === targetUid;
                if (!isSameUser) {
                    alert('Username already taken');
                    return;
                }
            }

            // Update user's username
            await usersRef.doc(targetUid).update({ username: newName.trim() });

            // Update existing messages authored by that user to reflect new username
            const messagesRef = db.collection('messages').where('userId', '==', targetUid);
            const messagesSnap = await messagesRef.get();
            if (!messagesSnap.empty) {
                const batch = db.batch();
                messagesSnap.docs.forEach(d => batch.update(d.ref, { username: newName.trim() }));
                await batch.commit();
            }

            alert('Username updated successfully');
        } catch (err) {
            console.error('Error changing username:', err);
            alert('Failed to change username. See console for details.');
        }
        return;
    }

    // Toggle mute/unmute for user (admin only)
    if (e.target.classList.contains('mute-user')) {
        const targetUid = e.target.dataset.userid;
        try {
            // Read current state to determine action
            const ud = await db.collection('users').doc(targetUid).get();
            const udata = ud.exists ? ud.data() : {};
            const mutedMs = getMillisFromTimestamp(udata && udata.mutedUntil);
            if (mutedMs && mutedMs > Date.now()) {
                // Currently muted -> unmute (remove field)
                await db.collection('users').doc(targetUid).update({ mutedUntil: firebase.firestore.FieldValue.delete() });
                alert('User unmuted');
                // update button UI if still in DOM
                e.target.textContent = '🔇';
                delete e.target.dataset.muted;
            } else {
                // Not muted -> mute for 10 minutes
                const muteUntil = firebase.firestore.Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000));
                await db.collection('users').doc(targetUid).update({ mutedUntil: muteUntil });
                alert('User muted for 10 minutes');
                e.target.textContent = '🔊';
                e.target.dataset.muted = '1';
            }
        } catch (err) {
            console.error('Error toggling mute for user:', err);
            alert('Failed to toggle mute. See console for details.');
        }
        return;
    }

    // Admin delete via admin-controls (delete current message)
    if (e.target.classList.contains('admin-delete')) {
        const messageId = e.target.dataset.id;
        const messageElem = e.target.closest('.message');

        try {
            await db.collection('messages').doc(messageId).delete();
            // Remove from DOM for immediate feedback if present
            if (messageElem && messageElem.parentNode) {
                messageElem.parentNode.removeChild(messageElem);
            }
        } catch (error) {
            console.error('Error deleting message via admin control:', error);
            alert('Error deleting message. Please try again.');
        }
        return;
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    auth.signOut();
});

// Load messages when page loads
loadMessages();

// Setup mute listener when auth state changes
auth.onAuthStateChanged((user) => {
    if (user) {
        setupMuteListener();
    } else {
        cleanupMuteListener();
    }
});

// Add this to your initialization code
document.addEventListener('DOMContentLoaded', async () => {
    await requestNotificationPermission();
});

// Handle visibility change
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        // Reset notification when tab becomes visible
        document.title = 'Hufflepuff Chat Room';
    }
}); 