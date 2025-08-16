import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, addDoc, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global variables for Firebase services
let firebaseApp;
let auth;
let db;

// Message Box and Overlay functions
const showMessage = (message, isError = false) => {
    const messageBox = document.createElement('div');
    messageBox.className = 'message-box';
    messageBox.innerHTML = `
        <div class="${isError ? 'text-red-500' : 'text-primary-color'}">
            <p class="font-semibold mb-2">${isError ? 'Error!' : 'Success!'}</p>
            <p>${message}</p>
            <button class="mt-4 px-4 py-2 bg-primary-color text-white rounded-lg hover:bg-teal-700">OK</button>
        </div>
    `;
    const overlay = document.createElement('div');
    overlay.className = 'overlay';

    messageBox.querySelector('button').onclick = () => {
        document.body.removeChild(messageBox);
        document.body.removeChild(overlay);
    };

    document.body.appendChild(overlay);
    document.body.appendChild(messageBox);
};

// UI helper function to show a specific page
window.showPage = (pageId) => {
    document.querySelectorAll('.page').forEach(page => page.style.display = 'none');
    document.getElementById(pageId).style.display = 'flex';
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top for a better user experience
    // Re-render Lucide icons for the new page
    lucide.createIcons();
};

// User profile and health data global state
let currentUser = null;
let userData = null;

// --- Firebase Configuration ---
// NOTE: Replace this with your own Firebase project credentials.
const firebaseConfig = {
    apiKey: "AIzaSyAg6p7_AnESepBSW2-wnIvSNklDtYNUntQ",
    authDomain: "myhealth360-e3925.firebaseapp.com",
    projectId: "myhealth360-e3925",
    storageBucket: "myhealth360-e3925.firebasestorage.app",
    messagingSenderId: "715968672088",
    appId: "1:715968672088:web:3434f7c310cbaff847352d",
    measurementId: "G-90HBNLVDHR"
};

// Use global variables from the Canvas environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfigString = typeof __firebase_config !== 'undefined' ? __firebase_config : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let parsedFirebaseConfig = firebaseConfig;
if (firebaseConfigString) {
    try {
        parsedFirebaseConfig = JSON.parse(firebaseConfigString);
    } catch (e) {
        console.error("Failed to parse Firebase config string:", e);
        showMessage("Firebase configuration error. Check the console for details.", true);
    }
}

// Initialize Firebase services and set up event listeners
const initFirebase = async () => {
    try {
        if (!parsedFirebaseConfig.projectId || parsedFirebaseConfig.projectId === "YOUR_PROJECT_ID") {
            showMessage("Firebase is not configured. Please add your project credentials to script.js", true);
            return;
        }
        
        firebaseApp = initializeApp(parsedFirebaseConfig);
        auth = getAuth(firebaseApp);
        db = getFirestore(firebaseApp);

        // Initial sign-in with custom token if available, otherwise anonymously
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            await signInAnonymously(auth);
        }

        // Listen for auth state changes
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUser = user;
                await fetchUserData(user);
                document.getElementById('login-page').style.display = 'none';
                document.getElementById('main-content').style.display = 'flex';
                showPage('dashboard-page');
                listenForReminders(user.uid);
            } else {
                currentUser = null;
                userData = null;
                document.getElementById('login-page').style.display = 'flex';
                document.getElementById('main-content').style.display = 'none';
            }
        });

    } catch (e) {
        console.error("Firebase initialization failed:", e);
        showMessage("Failed to initialize Firebase. Please check your configuration and try again.", true);
    }
};

// --- AUTHENTICATION LOGIC ---
document.getElementById('signin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signin-email').value;
    const password = document.getElementById('signin-password').value;
    setLoading(true);
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        showError(error.message);
    } finally {
        setLoading(false);
    }
});

document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const name = document.getElementById('signup-name').value;
    const age = document.getElementById('signup-age').value;
    const gender = document.getElementById('signup-gender').value;

    setLoading(true);
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await updateProfile(user, { displayName: name });
        const userRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile/info`);
        await setDoc(userRef, { name, age, gender, email });
    } catch (error) {
        showError(error.message);
    } finally {
        setLoading(false);
    }
});

document.getElementById('google-signin').addEventListener('click', async () => {
    setLoading(true);
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const userRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile/info`);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
            await setDoc(userRef, { name: user.displayName, age: '', gender: '', email: user.email });
        }
    } catch (error) {
        showError(error.message);
    } finally {
        setLoading(false);
    }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
        await signOut(auth);
    } catch (error) {
        showError("Logout failed: " + error.message);
    }
});

// Toggle between signin and signup forms
document.getElementById('toggle-signup').addEventListener('click', () => {
    document.getElementById('auth-forms').classList.add('hidden');
    document.getElementById('signup-forms').classList.remove('hidden');
});
document.getElementById('toggle-signin').addEventListener('click', () => {
    document.getElementById('auth-forms').classList.remove('hidden');
    document.getElementById('signup-forms').classList.add('hidden');
});

const setLoading = (isLoading) => {
    document.getElementById('loading').style.display = isLoading ? 'block' : 'none';
};

const showError = (message) => {
    document.getElementById('error-message').textContent = message;
};

// --- FIRESTORE DATA HANDLING ---
const fetchUserData = async (user) => {
    if (!user) return;
    try {
        const userRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile/info`);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            userData = userSnap.data();
            updateProfileUI();
            updateDashboardUI();
        }
    } catch (e) {
        console.error("Failed to fetch user data:", e);
        showError("Failed to load user profile.");
    }
};

const updateProfileUI = () => {
    if (userData) {
        document.getElementById('user-name').textContent = userData.name || 'User';
        document.getElementById('profile-name').value = userData.name || '';
        document.getElementById('profile-age').value = userData.age || '';
        document.getElementById('profile-gender').value = userData.gender || 'Male';
        document.getElementById('profile-email').value = userData.email || '';
    }
};

const updateDashboardUI = async () => {
    if (!currentUser) return;
    const userId = currentUser.uid;
    const docRef = doc(db, `artifacts/${appId}/users/${userId}/health_data/daily`);
    
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('steps-value').textContent = `Current: ${data.steps || 0} steps`;
            document.getElementById('sleep-value').textContent = `Current: ${data.sleep || 0} hours`;
            document.getElementById('water-value').textContent = `Current: ${data.water || 0} glasses`;
        }
    } catch (e) {
        console.error("Failed to load dashboard data:", e);
    }
};

// --- Dashboard Widget Logic ---
document.getElementById('steps-update').addEventListener('click', async () => {
    const stepsInput = document.getElementById('steps-input');
    const steps = parseInt(stepsInput.value);
    if (!isNaN(steps)) {
        await updateDashboardData('steps', steps);
        stepsInput.value = '';
    }
});

document.getElementById('sleep-update').addEventListener('click', async () => {
    const sleepInput = document.getElementById('sleep-input');
    const sleep = parseInt(sleepInput.value);
    if (!isNaN(sleep)) {
        await updateDashboardData('sleep', sleep);
        sleepInput.value = '';
    }
});

document.getElementById('water-update').addEventListener('click', async () => {
    const waterInput = document.getElementById('water-input');
    const water = parseInt(waterInput.value);
    if (!isNaN(water)) {
        await updateDashboardData('water', water);
        waterInput.value = '';
    }
});

const updateDashboardData = async (type, value) => {
    if (!currentUser) return;
    const userId = currentUser.uid;
    const docRef = doc(db, `artifacts/${appId}/users/${userId}/health_data/daily`);
    const date = new Date().toISOString().split('T')[0];
    try {
        await setDoc(docRef, { [type]: value, date }, { merge: true });
        await updateDashboardUI();
        showMessage(`Successfully updated ${type}!`);
    } catch (e) {
        console.error(`Failed to update ${type}:`, e);
        showError(`Failed to update ${type}.`);
    }
};

// --- AI Assistant Logic ---
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=";
const API_KEY = ""; // Canvas will provide this at runtime

const chatContainer = document.getElementById('chat-container');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-chat');
const chatLoading = document.getElementById('chat-loading');

const addMessage = (text, sender) => {
    const messageDiv = document.createElement('div');
    messageDiv.className = `flex ${sender === 'user' ? 'justify-end' : 'justify-start'}`;
    messageDiv.innerHTML = `
        <div class="${sender === 'user' ? 'bg-primary-color text-white' : 'bg-gray-200 text-gray-800'} p-4 rounded-xl max-w-xs shadow-sm">
            ${text}
        </div>
    `;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight; // Auto-scroll to the bottom
};

const handleAIChat = async () => {
    const prompt = chatInput.value.trim();
    if (!prompt) return;

    addMessage(prompt, 'user');
    chatInput.value = '';
    chatLoading.style.display = 'block';

    try {
        const chatHistory = [{
            role: 'user',
            parts: [{ text: prompt }]
        }];

        const payload = {
            contents: chatHistory,
        };

        const response = await fetch(`${API_URL}${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        const aiResponse = result?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (aiResponse) {
            addMessage(aiResponse + '<br><br><span class="text-sm opacity-60">This is not medical advice. Please consult a doctor for medical issues.</span>', 'ai');
        } else {
            addMessage("Sorry, I could not generate a response. Please try again.", 'ai');
        }
    } catch (error) {
        console.error("Gemini API call failed:", error);
        addMessage("I am unable to connect to the AI at the moment. Please try again later.", 'ai');
    } finally {
        chatLoading.style.display = 'none';
    }
};

sendButton.addEventListener('click', handleAIChat);
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        handleAIChat();
    }
});

// --- Doctor Booking Logic ---
const doctors = [
    { name: "Dr. Jane Doe", specialty: "Cardiologist", availability: "Mon, Wed, Fri", id: 'dr_jane' },
    { name: "Dr. John Smith", specialty: "Dermatologist", availability: "Tue, Thu", id: 'dr_john' },
    { name: "Dr. Emily White", specialty: "Pediatrician", availability: "Mon-Fri", id: 'dr_emily' },
];

const renderDoctors = () => {
    const doctorsList = document.getElementById('doctors-list');
    doctorsList.innerHTML = ''; // Clear list
    doctors.forEach(doctor => {
        const doctorCard = document.createElement('div');
        doctorCard.className = 'enhanced-card p-5 rounded-xl flex flex-col items-start';
        doctorCard.innerHTML = `
            <h3 class="text-xl font-bold">${doctor.name}</h3>
            <p class="text-gray-600 mb-2">${doctor.specialty}</p>
            <p class="text-sm text-gray-500 mb-4">Availability: ${doctor.availability}</p>
            <button class="book-btn w-full py-2 btn-primary font-semibold rounded-lg" data-id="${doctor.id}" data-name="${doctor.name}">Book Appointment</button>
        `;
        doctorsList.appendChild(doctorCard);
    });

    // Add event listeners to the new buttons
    document.querySelectorAll('.book-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const doctorId = e.target.dataset.id;
            const doctorName = e.target.dataset.name;
            await handleBookAppointment(doctorId, doctorName);
        });
    });
};

const handleBookAppointment = async (doctorId, doctorName) => {
    if (!currentUser) {
        showMessage("Please log in to book an appointment.", true);
        return;
    }
    try {
        const userId = currentUser.uid;
        const appointmentsRef = collection(db, `artifacts/${appId}/users/${userId}/appointments`);
        await addDoc(appointmentsRef, {
            doctorId: doctorId,
            doctorName: doctorName,
            date: new Date().toISOString().split('T')[0],
            status: 'pending'
        });
        showMessage(`Appointment with ${doctorName} booked successfully!`);
    } catch (e) {
        console.error("Failed to book appointment:", e);
        showError("Failed to book appointment.");
    }
};

// --- Reminders Logic ---
const addReminderForm = document.getElementById('add-reminder-form');
const remindersList = document.getElementById('reminders-list');
const dashboardRemindersList = document.getElementById('dashboard-reminders-list');

addReminderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = document.getElementById('reminder-text-input').value;
    const type = document.getElementById('reminder-type-select').value;
    if (!currentUser || !text.trim()) return;

    try {
        const userId = currentUser.uid;
        const remindersRef = collection(db, `artifacts/${appId}/users/${userId}/reminders`);
        await addDoc(remindersRef, { text, type, createdAt: new Date() });
        document.getElementById('reminder-text-input').value = '';
        showMessage("Reminder added successfully!");
    } catch (e) {
        console.error("Failed to add reminder:", e);
        showError("Failed to add reminder.");
    }
});

const listenForReminders = (userId) => {
    if (!db || !userId) return;
    const remindersRef = collection(db, `artifacts/${appId}/users/${userId}/reminders`);

    onSnapshot(remindersRef, (snapshot) => {
        const remindersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderReminders(remindersData);
    }, (e) => {
        console.error("Error fetching reminders:", e);
    });
};

const renderReminders = (remindersData) => {
    remindersList.innerHTML = '';
    dashboardRemindersList.innerHTML = '';

    remindersData.forEach(reminder => {
        // Main Reminders page list
        const mainReminderItem = document.createElement('li');
        mainReminderItem.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg shadow-sm';
        mainReminderItem.innerHTML = `
            <div class="flex-1">
                <span class="text-sm font-semibold text-secondary-color">${reminder.type.charAt(0).toUpperCase() + reminder.type.slice(1)}:</span>
                <p class="text-gray-800">${reminder.text}</p>
            </div>
            <button class="delete-reminder-btn text-red-500 hover:text-red-700 transition duration-200" data-id="${reminder.id}">
                <i data-lucide="x-circle"></i>
            </button>
        `;
        remindersList.appendChild(mainReminderItem);

        // Dashboard reminders widget
        const dashboardReminderItem = document.createElement('li');
        dashboardReminderItem.className = 'flex items-center gap-2';
        dashboardReminderItem.innerHTML = `
            <i data-lucide="${getReminderIcon(reminder.type)}" class="text-primary-color w-4 h-4"></i>
            <p class="text-sm text-gray-800 truncate">${reminder.text}</p>
        `;
        dashboardRemindersList.appendChild(dashboardReminderItem);
    });

    // Re-render Lucide icons
    lucide.createIcons();

    // Add event listeners for delete buttons
    document.querySelectorAll('.delete-reminder-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const reminderId = e.currentTarget.dataset.id;
            await handleDeleteReminder(reminderId);
        });
    });
};

const handleDeleteReminder = async (id) => {
    if (!currentUser) return;
    try {
        const userId = currentUser.uid;
        const reminderRef = doc(db, `artifacts/${appId}/users/${userId}/reminders`, id);
        await deleteDoc(reminderRef);
        showMessage("Reminder deleted.");
    } catch (e) {
        console.error("Failed to delete reminder:", e);
        showError("Failed to delete reminder.");
    }
};

const getReminderIcon = (type) => {
    switch(type) {
        case 'medicine': return 'pill';
        case 'water': return 'droplet';
        case 'appointment': return 'calendar-check';
        default: return 'bell';
    }
};

// --- Profile Page Logic ---
const profileForm = document.getElementById('profile-form');
profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const newName = document.getElementById('profile-name').value;
    const newAge = document.getElementById('profile-age').value;
    const newGender = document.getElementById('profile-gender').value;

    try {
        const userRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/profile/info`);
        await setDoc(userRef, {
            name: newName,
            age: newAge,
            gender: newGender,
            email: currentUser.email // Keep email as it is
        }, { merge: true });
        await updateProfile(currentUser, { displayName: newName });
        showMessage("Profile updated successfully!");
        await fetchUserData(currentUser); // Refresh local data
    } catch (e) {
        console.error("Failed to update profile:", e);
        showError("Failed to save changes.");
    }
});

// Initialize on window load
window.onload = () => {
    initFirebase();
    renderDoctors();
    lucide.createIcons();
};

