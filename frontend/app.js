const API_BASE_URL = 'http://127.0.0.1:8000';

// Global state
let currentKpiData = null;
let currentView = 'dashboard';
let currentBorrowerId = null;
let authToken = sessionStorage.getItem('auth_token');

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded at', new Date().toLocaleTimeString());
    updateCurrentDate();
    setupEventListeners();
    checkAuth();
});

// Authentication Check
function checkAuth() {
    const loginScreen = document.getElementById('login-screen');
    const mainApp = document.getElementById('mainApp');

    if (authToken) {
        // Authenticated
        loginScreen.style.display = 'none';
        mainApp.style.display = 'flex';

        // Update User Profile UI
        const storedUser = sessionStorage.getItem('user_name') || 'Admin';
        const displayUserName = document.getElementById('display-userName');
        const sidebarUserName = document.getElementById('sidebar-userName');
        const avatarInitial = document.getElementById('user-avatar-initial');

        if (displayUserName) displayUserName.textContent = storedUser;
        if (sidebarUserName) sidebarUserName.textContent = storedUser;
        if (avatarInitial) avatarInitial.textContent = storedUser.charAt(0).toUpperCase();

        // Recovery data from storage if it exists (Data in Local; View in Session)
        const savedData = sessionStorage.getItem('finance_data');
        const savedView = sessionStorage.getItem('current_view') || 'dashboard';
        const savedBorrowerId = sessionStorage.getItem('current_borrower_id');

        console.log('Storage Check:', {
            hasData: !!savedData,
            view: savedView,
            borrower: savedBorrowerId
        });

        if (savedData) {
            console.log('🔄 Attempting to recover data...');
            try {
                const data = JSON.parse(savedData);
                if (data && data.kpis) {
                    currentKpiData = data;
                    updateDashboard(data);
                    console.log('Data successfully recovered from session storage');

                    // Restore the previous view
                    if (savedView === 'summary-details') {
                        const savedPeriod = sessionStorage.getItem('current_period_key');
                        if (savedPeriod) {
                            console.log('Restoring Summary Details List view for:', savedPeriod);
                            showSummaryDetailsListView(savedPeriod);
                        }
                    } else {
                        showView(savedView);
                    }
                }
            } catch (e) {
                console.error('❌ Failed to parse saved data', e);
                sessionStorage.removeItem('finance_data');
            }
        } else {
            console.log('ℹ️ No saved data found in sessionStorage');
        }
    } else {
        // Not authenticated
        loginScreen.style.display = 'flex';
        mainApp.style.display = 'none';
    }
}

// Update current date
function updateCurrentDate() {
    const dateElement = document.getElementById('currentDate');
    const now = new Date();
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    const formattedDate = now.toLocaleDateString('en-US', options);

    // Format: "Friday, 10th February"
    const day = now.getDate();
    const suffix = getDaySuffix(day);
    const monthYear = now.toLocaleDateString('en-US', { month: 'long' });
    const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });

    dateElement.textContent = `${weekday}, ${day}${suffix} ${monthYear}`;
}

function getDaySuffix(day) {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
}

// Setup event listeners
function setupEventListeners() {
    // File upload handler
    const fileInput = document.getElementById('fileUpload');
    if (fileInput) fileInput.addEventListener('change', handleFileUpload);

    // View details buttons
    const viewDetailsBtns = document.querySelectorAll('.view-details-btn');
    viewDetailsBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.period-card');
            const period = card.dataset.period;

            let periodKey = '';
            if (period === '1to7') periodKey = '1-7_days';
            else if (period === 'more7') periodKey = 'More_than_7_days';
            else if (period === 'today') periodKey = 'Today';

            showSummaryDetailsListView(periodKey);
        });
    });

    // Back button
    const backBtn = document.getElementById('backToDashboard');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            showView('dashboard');
        });
    }

    // Make bulk call button
    const makeBulkCallBtn = document.getElementById('makeBulkCallBtn');
    if (makeBulkCallBtn) {
        makeBulkCallBtn.addEventListener('click', handleBulkCall);
    }

    // Modal close
    const closeBtn = document.querySelector('.close-btn');
    const modal = document.getElementById('detailsModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    }

    // Sidebar navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetView = item.getAttribute('data-view');
            showView(targetView);
        });
    });

    // Login Form handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Logout button handler (Legacy)
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // User Menu Handler
    const userProfileTrigger = document.getElementById('userProfileTrigger');
    const userMenu = document.getElementById('userMenu');
    const userLogoutBtn = document.getElementById('userLogoutBtn');

    if (userProfileTrigger && userMenu) {
        userProfileTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            userMenu.classList.toggle('active');
        });

        // Use document click to close menu (already existing logic below needs to be checked)
        document.addEventListener('click', (e) => {
            if (!userProfileTrigger.contains(e.target) && !userMenu.contains(e.target)) {
                userMenu.classList.remove('active');
            }
        });
    }

    if (userLogoutBtn) {
        userLogoutBtn.addEventListener('click', handleLogout);
    }
}

// Handle Login
async function handleLogin(e) {
    e.preventDefault();
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');

    if (!usernameInput || !passwordInput) return;

    const username = usernameInput.value;
    const password = passwordInput.value;

    showLoading(true);

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Login failed');
        }

        const data = await response.json();
        authToken = data.access_token;
        sessionStorage.setItem('auth_token', authToken);
        sessionStorage.setItem('user_name', data.user.username);

        showNotification('Login successful!', 'success');
        checkAuth();
    } catch (error) {
        console.error('Login error:', error);
        showNotification(`Login Error: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

// Handle Logout
function handleLogout() {
    authToken = null;
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('user_name');
    sessionStorage.clear(); // Clear view state

    showNotification('Logged out successfully', 'info');
    checkAuth();
}

// Helper to switch views
function showView(viewId) {
    const sections = document.querySelectorAll('.view-section');
    const navItems = document.querySelectorAll('.nav-item');
    const headerActions = document.getElementById('headerActions');

    // Reset state
    currentView = viewId;
    sessionStorage.setItem('current_view', viewId);

    if (viewId === 'dashboard') {
        currentBorrowerId = null;
        sessionStorage.removeItem('current_borrower_id');
        sessionStorage.removeItem('current_period_key');
        if (headerActions) headerActions.style.display = 'flex';
    } else {
        if (headerActions) headerActions.style.display = 'none';

        // Render reports if that's the view
        if (viewId === 'reports') {
            renderReportsTable();
        }
    }

    // Update Nav
    navItems.forEach(nav => {
        if (nav.getAttribute('data-view') === viewId) {
            nav.classList.add('active');
        } else {
            nav.classList.remove('active');
        }
    });

    // Update Sections
    sections.forEach(section => {
        section.classList.remove('active');
    });

    const targetElement = document.getElementById(`${viewId}-view`);
    if (targetElement) {
        targetElement.classList.add('active');
    }
}

// Handle file upload
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    console.log('File upload started:', file.name);

    // Validate file type
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValid) {
        alert('Please upload a valid Excel or CSV file (.xlsx, .xls, .csv)');
        event.target.value = '';
        return;
    }

    showLoading(true);

    try {
        // Verify user is authenticated
        const token = sessionStorage.getItem('auth_token');
        console.log('🔐 Token check:', token ? 'Token found' : 'No token');

        if (!token) {
            console.error('❌ No token found - logging out');
            showNotification('Please login first to upload data', 'error');
            handleLogout();
            return;
        }

        console.log('📤 Starting file upload with authentication...');
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE_URL}/data_ingestion/data?include_details=true`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!response.ok) {
            // Handle authentication errors
            if (response.status === 401) {
                showNotification('Session expired. Please login again.', 'error');
                handleLogout();
                return;
            }

            const error = await response.json();
            throw new Error(error.detail || 'Failed to upload file');
        }

        const data = await response.json();
        console.log('API Response received successfully');

        // Reset call states for new data
        if (data.detailed_breakdown?.by_due_date_category) {
            Object.values(data.detailed_breakdown.by_due_date_category).flat().forEach(b => {
                b.call_in_progress = false;
                b.call_completed = false;
            });
        }

        currentKpiData = data;
        // Persist data so it survives reloads (but not new sessions)
        sessionStorage.setItem('finance_data', JSON.stringify(data));
        console.log('✅ Data persisted to sessionStorage');

        updateDashboard(data);
        showNotification('File uploaded successfully!', 'success');
    } catch (error) {
        console.error('Upload error:', error);
        showNotification(`Error: ${error.message}`, 'error');
    } finally {
        showLoading(false);
        event.target.value = ''; // Reset file input
    }
}

// Update dashboard with KPI data
function updateDashboard(data) {
    if (!data || !data.kpis) return;

    // Update overview KPIs
    const borrowersEl = document.getElementById('totalBorrowers');
    const arrearsEl = document.getElementById('totalArrears');

    if (borrowersEl) borrowersEl.textContent = data.kpis.total_borrowers || 0;
    if (arrearsEl) arrearsEl.textContent =
        `₹${(data.kpis.total_arrears || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    if (data.detailed_breakdown && data.detailed_breakdown.by_due_date_category) {
        const byDate = data.detailed_breakdown.by_due_date_category;
        updateCardLocal('more7', byDate['More_than_7_days']);
        updateCardLocal('oneToSeven', byDate['1-7_days']);
        updateCardLocal('today', byDate['Today']);
    }
}

// Helper to calculate counts locally and update UI
function updateCardLocal(prefix, borrowersList) {
    if (!borrowersList || !Array.isArray(borrowersList)) {
        document.querySelector(`#${prefix}-consistent .count`).textContent = 0;
        document.querySelector(`#${prefix}-inconsistent .count`).textContent = 0;
        document.querySelector(`#${prefix}-overdue .count`).textContent = 0;
        return;
    }

    let consistent = 0, inconsistent = 0, overdue = 0;

    borrowersList.forEach(b => {
        const category = b.Payment_Category;
        if (category === 'Consistent') consistent++;
        else if (category === 'Inconsistent') inconsistent++;
        else if (category === 'Overdue') overdue++;
    });

    document.querySelector(`#${prefix}-consistent .count`).textContent = consistent;
    document.querySelector(`#${prefix}-inconsistent .count`).textContent = inconsistent;
    document.querySelector(`#${prefix}-overdue .count`).textContent = overdue;
}

// Show Summary Details List View
function showSummaryDetailsListView(periodKey) {
    console.log('Showing summary details list for period:', periodKey);

    if (!currentKpiData || !currentKpiData.detailed_breakdown) {
        showNotification('No data available. Please upload a file.', 'warning');
        return;
    }

    const byDate = currentKpiData.detailed_breakdown.by_due_date_category;
    const borrowers = byDate[periodKey] || [];

    // Map keys to labels
    const periodLabels = {
        'More_than_7_days': 'More than 7 Days',
        '1-7_days': '1-7 Days',
        'Today': '6th Feb (Today Data)'
    };

    const labelEl = document.getElementById('selectedPeriodLabel');
    if (labelEl) labelEl.textContent = periodLabels[periodKey] || periodKey;

    // Reset any stale call states for these borrowers when opening the view fresh
    borrowers.forEach(b => {
        if (!b.call_completed) { // Only reset if not already successful
            b.call_in_progress = false;
        }
    });

    // Save state
    currentView = 'summary-details';
    sessionStorage.setItem('current_view', currentView);
    sessionStorage.setItem('current_period_key', periodKey);

    // Switch view
    showView('summary-details');

    // Populate rows
    const container = document.getElementById('callRowsContainer');
    container.innerHTML = '';

    if (borrowers.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #6b7280;">No borrowers found in this section.</div>';
        return;
    }

    borrowers.forEach(borrower => {
        const rowWrapper = createCallDataRow(borrower);
        container.appendChild(rowWrapper);
    });

    window.scrollTo(0, 0);
}

// Create a call data row
function createCallDataRow(borrower) {
    const wrapper = document.createElement('div');
    wrapper.className = 'call-row-wrapper';
    wrapper.id = `row-${borrower.NO}`;

    const interactionType = borrower.Payment_Category || 'Normal';
    const statusClass = interactionType.toLowerCase();

    // Call Status Logic
    let callStatus = "Yet To Call";
    let statusBtnClass = "yet-to-call";

    if (borrower.call_in_progress) {
        callStatus = "In progress";
        statusBtnClass = "in-progress";
    } else if (borrower.call_completed) {
        callStatus = "Call Success";
        statusBtnClass = "success";
    }

    const lastPaid = borrower.LAST_PAID_DATE || borrower.DUE_DATE || 'N/A';
    const amount = (borrower.AMOUNT || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const totalAmount = (borrower.TOTAL_LOAN || (borrower.AMOUNT * 1.5) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

    wrapper.innerHTML = `
        <div class="call-row">
            <div class="borrower-cell">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(borrower.BORROWER)}&background=random" class="borrower-avatar" alt="${borrower.BORROWER}">
                <div class="borrower-meta">
                    <h4>${borrower.BORROWER}</h4>
                    <p>Last paid: ${lastPaid}</p>
                </div>
            </div>
            <div class="due-cell">$${amount}</div>
            <div class="total-cell">$${totalAmount}</div>
            <div class="status-cell ${statusClass}">${interactionType}</div>
            <div class="action-cell">
                <button class="status-btn ${statusBtnClass}">
                    <span>${callStatus}</span>
                    <span class="dropdown-icon">▼</span>
                </button>
            </div>
        </div>
        <div class="expanded-content">
            <div class="conversation-card">
                <div class="card-header">
                    <span class="icon">✨</span> AI Conversation
                </div>
                <div class="chat-bubbles" id="transcript-${borrower.NO}">
                    ${renderTranscript(borrower.transcript)}
                </div>
            </div>
            <div class="summary-card" id="summary-card-${borrower.NO}">
                <div class="card-header">
                    <span class="icon">✨</span> AI Summary
                </div>
                <div class="next-steps-title">Next Steps</div>
                <div class="next-steps-text" id="summary-text-${borrower.NO}">
                    ${borrower.ai_summary || 'No call summary yet. Initiate a call to get AI insights.'}
                </div>
                <button class="manual-btn">Initiate Manual Process</button>
            </div>
        </div>
    `;

    // Toggle expansion
    wrapper.querySelector('.call-row').addEventListener('click', () => {
        wrapper.classList.toggle('expanded');
    });

    return wrapper;
}

// Render transcript bubbles
function renderTranscript(transcript) {
    if (!transcript || transcript.length === 0) {
        return '<div class="chat-bubble ai">No conversation recorded yet.</div>';
    }

    return transcript.map(t => `
        <div class="chat-bubble ${t.speaker.toLowerCase() === 'ai' ? 'ai' : 'person'}">
            ${t.text}
        </div>
    `).join('');
}

// Handle bulk call
async function handleBulkCall() {
    const periodKey = sessionStorage.getItem('current_period_key');
    if (!periodKey || !currentKpiData) return;

    const borrowers = currentKpiData.detailed_breakdown.by_due_date_category[periodKey] || [];
    if (borrowers.length === 0) {
        showNotification('No borrowers to call.', 'warning');
        return;
    }

    showNotification(`Triggering parallel calls for ${borrowers.length} borrowers...`, 'info');

    const makeBulkCallBtn = document.getElementById('makeBulkCallBtn');
    if (makeBulkCallBtn) makeBulkCallBtn.disabled = true;

    // Update UI to "In progress"
    borrowers.forEach(b => {
        b.call_in_progress = true;
        b.call_completed = false;

        const row = document.getElementById(`row-${b.NO}`);
        if (row) {
            const btn = row.querySelector('.status-btn');
            if (btn) {
                btn.className = 'status-btn in-progress';
                const span = btn.querySelector('span');
                if (span) span.textContent = 'In progress';
            }
        }
    });

    try {
        const payload = {
            borrowers: borrowers.map(b => ({
                NO: String(b.NO || ''),
                cell1: String(b.cell1 || ''),
                preferred_language: String(b.preferred_language || 'en-IN')
            })),
            use_dummy_data: true
        };

        const response = await fetch(`${API_BASE_URL}/ai_calling/trigger_calls`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            if (response.status === 401) {
                showNotification('Session expired. Please login again.', 'error');
                handleLogout();
                return;
            }
            throw new Error('Bulk call request failed');
        }

        const result = await response.json();
        console.log('Bulk Call Results:', result);

        // Update local state and UI
        result.results.forEach(res => {
            // Use loose equality (==) to handle string vs number comparison
            const borrower = borrowers.find(b => b.NO == res.borrower_id);
            if (borrower) {
                console.log(`Updating UI for borrower ${res.borrower_id}`);
                borrower.call_in_progress = false;
                borrower.call_completed = res.success;

                // Update AI Analysis Data
                if (res.ai_analysis) {
                    borrower.ai_intent = res.ai_analysis.intent;
                    borrower.ai_payment_date = res.ai_analysis.payment_date;
                    borrower.ai_summary = res.ai_analysis.summary;
                } else {
                    borrower.ai_summary = res.success ? 'Call completed.' : 'Call failed: ' + res.error;
                }

                borrower.transcript = res.conversation || [];

                // Update Row UI
                const row = document.getElementById(`row-${borrower.NO}`);
                if (row) {
                    const btn = row.querySelector('.status-btn');
                    if (btn) {
                        const span = btn.querySelector('span');
                        if (res.success) {
                            btn.className = 'status-btn success';
                            if (span) span.textContent = 'Call Success';
                        } else {
                            btn.className = 'status-btn yet-to-call';
                            if (span) span.textContent = 'Yet To Call';
                        }
                    }

                    // Update Transcript in expanded content
                    const transcriptEl = document.getElementById(`transcript-${borrower.NO}`);
                    if (transcriptEl) {
                        transcriptEl.innerHTML = renderTranscript(borrower.transcript);
                    }

                    // Update Summary in expanded content
                    const summaryEl = document.getElementById(`summary-text-${borrower.NO}`);
                    if (summaryEl) {
                        summaryEl.textContent = borrower.ai_summary;
                    }
                }
            } else {
                console.warn(`Could not find borrower ${res.borrower_id} in current list to update UI.`);
            }
        });

        // Save state
        sessionStorage.setItem('finance_data', JSON.stringify(currentKpiData));
        showNotification(`Bulk call completed! ${result.successful_calls} successful.`, 'success');

        // Refresh reports table if active
        if (currentView === 'reports') {
            renderReportsTable();
        }

    } catch (error) {
        console.error('Bulk call error:', error);
        showNotification(`Error: ${error.message}`, 'error');

        // Reset progress status on error
        borrowers.forEach(b => {
            b.call_in_progress = false;
            const row = document.getElementById(`row-${b.NO}`);
            if (row) {
                const btn = row.querySelector('.status-btn');
                if (btn) {
                    btn.className = 'status-btn yet-to-call';
                    btn.querySelector('span').textContent = 'Yet To Call';
                }
            }
        });
    } finally {
        if (makeBulkCallBtn) makeBulkCallBtn.disabled = false;
    }
}

// Show/hide loading spinner
function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    spinner.style.display = show ? 'flex' : 'none';
}

// Show notification (basic version)
function showNotification(message, type = 'info') {
    // You can enhance this with a proper toast notification library
    const styles = {
        success: 'background: #10b981; color: white;',
        error: 'background: #ef4444; color: white;',
        warning: 'background: #f59e0b; color: white;',
        info: 'background: #3b82f6; color: white;'
    };

    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        border-radius: 12px;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 3000;
        animation: slideInRight 0.3s ease;
        ${styles[type] || styles.info}
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Render Reports Table
function renderReportsTable() {
    const tbody = document.getElementById('reportsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!currentKpiData || !currentKpiData.detailed_breakdown) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 40px; color: #6b7280;">No data available. Please upload a file.</td></tr>';
        return;
    }

    const allBorrowers = [];
    const breakdown = currentKpiData.detailed_breakdown.by_due_date_category;

    if (breakdown) {
        Object.values(breakdown).forEach(list => {
            if (Array.isArray(list)) allBorrowers.push(...list);
        });
    }

    if (allBorrowers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 40px; color: #6b7280;">No records found.</td></tr>';
        return;
    }

    // Sort by ID for consistency
    allBorrowers.sort((a, b) => String(a.NO).localeCompare(String(b.NO)));

    allBorrowers.forEach(b => {
        const tr = document.createElement('tr');

        // Determine call status and badge
        let callStatus = 'Pending';
        let statusClass = 'pending'; // orange

        if (b.call_completed) {
            callStatus = b.call_completed === true ? 'Completed' : 'Failed';
            statusClass = b.call_completed === true ? 'green' : 'red';
        } else if (b.call_in_progress) {
            callStatus = 'In Progress';
            statusClass = 'orange';
        }

        // Format Currency
        const amount = (b.AMOUNT || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
        const emi = (b.EMI || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

        // AI Provided Data
        const payConf = b.ai_intent || '-';
        const followUpDate = b.ai_payment_date || '-';

        tr.innerHTML = `
            <td>${b.NO || '-'}</td>
            <td style="font-weight: 500;">${b.BORROWER || '-'}</td>
            <td>${amount}</td>
            <td>${b.cell1 || '-'}</td>
            <td>${emi}</td>
            <td>${b.preferred_language || 'en-IN'}</td>
            <td><span class="status-badge ${getIntentBadgeClass(payConf)}">${payConf}</span></td>
            <td>${followUpDate}</td>
            <td>${b['LAST DUE REVD DATE'] || '-'}</td>
            <td>${b['FIRST DUE DATE'] || '-'}</td>
            <td><span class="status-badge ${statusClass}">${callStatus}</span></td>
        `;

        tbody.appendChild(tr);
    });
}

function getIntentBadgeClass(intent) {
    if (!intent) return '';
    const i = intent.toLowerCase();
    if (i.includes('paid') || i.includes('will pay')) return 'green';
    if (i.includes('dispute') || i.includes('negative')) return 'red';
    if (i.includes('extension')) return 'orange';
    return 'gray';
}

// Export to CSV
function exportReportsToCSV() {
    if (!currentKpiData || !currentKpiData.detailed_breakdown) {
        showNotification('No data to export', 'warning');
        return;
    }

    const allBorrowers = [];
    const breakdown = currentKpiData.detailed_breakdown.by_due_date_category;
    if (breakdown) {
        Object.values(breakdown).forEach(list => {
            if (Array.isArray(list)) allBorrowers.push(...list);
        });
    }

    if (allBorrowers.length === 0) {
        showNotification('No records to export', 'warning');
        return;
    }

    // Define CSV Headers
    const headers = [
        'NO', 'BORROWER', 'AMOUNT', 'MOBILE', 'EMI', 'LANGUAGE',
        'PAY CONFIRMATION', 'FOLLOW UP DATE', 'LAST DUE REVD DATE', 'FIRST DUE DATE', 'CALL STATUS', 'AI SUMMARY'
    ];

    // Create CSV Content
    const rows = allBorrowers.map(b => [
        b.NO,
        `"${b.BORROWER}"`,
        b.AMOUNT,
        b.cell1,
        b.EMI,
        b.preferred_language,
        b.ai_intent || '',
        b.ai_payment_date || '',
        b['LAST DUE REVD DATE'] || '',
        b['FIRST DUE DATE'] || '',
        b.call_completed ? 'Completed' : 'Pending',
        `"${(b.ai_summary || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(r => r.join(','))
    ].join('\n');

    // Create Download Link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Details_Report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Report exported successfully', 'success');
}

// Add event listeners for reports
// (Note: This duplicates the DOMContentLoaded listener logic at top of file,
// but since we are overwriting, we should consolidate content.
// Wait, the DOMContentLoaded at top calls setupEventListeners.
// I should add the new button listeners to setupEventListeners function instead of a new DOMContentLoaded block.
// Initialize Reports Buttons
document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('refreshReportsBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', renderReportsTable);
    }

    const exportBtn = document.getElementById('exportCsvBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportReportsToCSV);
    }
});
