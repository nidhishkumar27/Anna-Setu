document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const signupForm = document.getElementById('signupForm');
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const roleSelect = document.getElementById('role');
    const donorTypeWrapper = document.getElementById('donorTypeWrapper');
    const donorTypeSelect = document.getElementById('donorType');
    const fssaiWrapper = document.getElementById('fssaiWrapper');
    const fssaiInput = document.getElementById('fssaiLicense');
    const togglePasswordBtn = document.getElementById('togglePassword');
    const signupBtn = document.getElementById('signupBtn');
    const notification = document.getElementById('notification');

    const API_BASE_URL = 'http://localhost:4000/api';

    // --- Event Listeners ---
    signupForm.addEventListener('submit', handleSignup);
    togglePasswordBtn.addEventListener('click', togglePasswordVisibility);
    // Show/hide the donor type dropdown and FSSAI field based on role/donorType
    roleSelect.addEventListener('change', () => {
        if (roleSelect.value === 'donor') {
            donorTypeWrapper.style.display = 'block';
            // Reset donorType selection and hide FSSAI whenever role changes to donor
            donorTypeSelect.value = '';
            fssaiWrapper.style.display = 'none';
            fssaiInput.value = '';
        } else {
            donorTypeWrapper.style.display = 'none';
            fssaiWrapper.style.display = 'none';
            fssaiInput.value = '';
        }
    });

    // Toggle FSSAI field when donor type changes
    donorTypeSelect.addEventListener('change', () => {
        if (donorTypeSelect.value === 'regular') {
            fssaiWrapper.style.display = 'block';
        } else {
            fssaiWrapper.style.display = 'none';
            fssaiInput.value = '';
        }
    });

    // --- Functions ---
    async function handleSignup(event) {
        event.preventDefault();

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const role = roleSelect.value;
        
        if (!name || !email || !password || !role) {
            showNotification('Please fill out all required fields.', 'error');
            return;
        }

        // Construct the payload to send to the backend
        const payload = { name, email, password, role };
        if (role === 'donor') {
            const selectedDonorType = donorTypeSelect.value;
            if (!selectedDonorType) {
                showNotification('Please select a donor type.', 'error');
                return;
            }
            payload.donorType = selectedDonorType;
            if (selectedDonorType === 'regular') {
                const rawFssai = fssaiInput.value || '';
                const fssai = rawFssai.replace(/[\s-]/g, '').trim();
                if (!fssai) {
                    showNotification('FSSAI License Number is required for Regular donors / restaurants.', 'error');
                    fssaiInput.focus();
                    return;
                }
                if (!/^\d{14}$/.test(fssai)) {
                    showNotification('Please enter a valid 14-digit FSSAI License Number.', 'error');
                    fssaiInput.focus();
                    return;
                }
                payload.fssaiLicense = fssai;
            }
        }

        setLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Registration failed.');
            }

            showNotification(data.message, 'success');
            
            // Redirect to login page after successful registration
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);

        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }
    
    // Helper functions (same as in login.js, can be moved to a common file later)
    function togglePasswordVisibility() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.querySelector('i').classList.toggle('fa-eye');
        this.querySelector('i').classList.toggle('fa-eye-slash');
    }

    function setLoading(isLoading) {
        const btnText = document.getElementById('btnText');
        const btnLoader = document.getElementById('btnLoader');
        if (isLoading) {
            btnText.style.display = 'none';
            btnLoader.style.display = 'inline-block';
            signupBtn.disabled = true;
        } else {
            btnText.style.display = 'inline-block';
            btnLoader.style.display = 'none';
            signupBtn.disabled = false;
        }
    }

    function showNotification(message, type) {
        notification.textContent = message;
        notification.className = type;
        notification.classList.add('show');
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
});