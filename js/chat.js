console.log('Chat.js loaded');

const messagesDiv = document.getElementById('messages');
const messageForm = document.getElementById('messageForm');
const logoutBtn = document.getElementById('logoutBtn');
const imageInput = document.getElementById('imageInput');
const addImageBtn = document.getElementById('addImageBtn');
const selectedImageName = document.getElementById('selectedImageName');
const messageInput = document.getElementById('messageInput');
const notificationSound = new Audio('sounds/message.mp3');
let notificationPermission = false;

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
            icon: '/favicon.ico' // Add a favicon.ico to your project root if you want an icon
        });

        // Play sound
        notificationSound.play().catch(error => {
            console.error('Error playing sound:', error);
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
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
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
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
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
    
    try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.data();
        
        if (!userData) {
            throw new Error('User data not found');
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
        alert('Error sending message. Please try again.');
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
                
                const messageHTML = `
                    ${message.userId === auth.currentUser.uid ? '<span class="delete-message" data-id="' + doc.id + '">×</span>' : ''}
                    ${profilePic}
                    <div class="message-content">
                        <strong>${message.username || 'Unknown User'}</strong>
                        ${imageContent}
                        ${message.text ? `<p>${message.text}</p>` : ''}
                        ${timestampHTML}
                    </div>
                `;
                
                messageElement.innerHTML = messageHTML;
                messagesDiv.appendChild(messageElement);
            });
            
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            isFirstLoad = false;
        });
}

// Delete message
messagesDiv.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-message')) {
        try {
            const messageId = e.target.dataset.id;
            await db.collection('messages').doc(messageId).delete();
        } catch (error) {
            console.error('Error deleting message:', error);
            alert('Error deleting message. Please try again.');
        }
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    auth.signOut();
});

// Load messages when page loads
loadMessages();

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