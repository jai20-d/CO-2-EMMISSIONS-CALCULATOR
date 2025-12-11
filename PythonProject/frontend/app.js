// EcoTrack Carbon Calculator - Complete Frontend
const API_BASE = 'http://127.0.0.1:8000';

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    initCategoryTabs();
    checkApiStatus();
    loadHistory();
    updateDashboard();

    // Auto-refresh every 30 seconds
    setInterval(checkApiStatus, 30000);
    setInterval(loadHistory, 60000);
});

// ========== API STATUS ==========
function checkApiStatus() {
    const statusIndicator = document.getElementById('api-status-indicator');
    const statusText = document.getElementById('api-status-text');

    fetch(`${API_BASE}/health`)
        .then(response => {
            if (response.ok) {
                if (statusIndicator) {
                    statusIndicator.className = 'status-indicator online';
                    statusIndicator.title = 'API is online';
                }
                if (statusText) {
                    statusText.textContent = 'Online';
                    statusText.style.color = '#10b981';
                }
                return true;
            }
            throw new Error('API not responding');
        })
        .catch(error => {
            console.warn('API is offline:', error);
            if (statusIndicator) {
                statusIndicator.className = 'status-indicator offline';
                statusIndicator.title = 'API is offline';
            }
            if (statusText) {
                statusText.textContent = 'Offline';
                statusText.style.color = '#ef4444';
            }
            return false;
        });
}

// ========== CALCULATOR FUNCTIONS ==========
function initCategoryTabs() {
    const tabs = document.querySelectorAll('.category-tab');
    if (!tabs.length) return;

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const category = tab.dataset.category;
            updateActivityOptions(category);
        });
    });

    // Initialize first category
    updateActivityOptions('transport');
}

function updateActivityOptions(category) {
    const activitySelect = document.getElementById('activity');
    const unitDisplay = document.getElementById('unit');

    if (!activitySelect) return;

    // Define activities for each category
    const activities = {
        transport: [
            {value: 'car_petrol', label: 'Car (Petrol)'},
            {value: 'car_diesel', label: 'Car (Diesel)'},
            {value: 'bus', label: 'Bus'},
            {value: 'train', label: 'Train'},
            {value: 'plane', label: 'Airplane'},
            {value: 'electric_car', label: 'Electric Car'}
        ],
        electricity: [
            {value: 'grid', label: 'Grid Electricity'},
            {value: 'solar', label: 'Solar Power'},
            {value: 'wind', label: 'Wind Power'},
            {value: 'coal', label: 'Coal Power'}
        ],
        food: [
            {value: 'beef', label: 'flour'},
            {value: 'chicken', label: 'Chicken'},
            {value: 'rice', label: 'Rice'},
            {value: 'vegetables', label: 'Vegetables'},

        ],
        waste: [
            {value: 'landfill', label: 'Landfill'},
            {value: 'recycled', label: 'Recycled'},
            {value: 'composted', label: 'Composted'},
            {value: 'plastic', label: 'Plastic Waste'}
        ]
    };

    // Clear and add new options
    activitySelect.innerHTML = '';
    const categoryActivities = activities[category] || activities.transport;

    categoryActivities.forEach(activity => {
        const option = document.createElement('option');
        option.value = activity.value;
        option.textContent = activity.label;
        activitySelect.appendChild(option);
    });

    // Update unit
    const units = {
        transport: 'km',
        electricity: 'kWh',
        food: 'kg',
        waste: 'kg'
    };

    if (unitDisplay) {
        unitDisplay.textContent = units[category] || 'unit';
    }
}

// ========== MAIN CALCULATION FUNCTION ==========
function calculateEmission() {
    console.log("Calculate button clicked!");

    // Get form values
    const category = getActiveCategory();
    const activity = document.getElementById('activity')?.value;
    const amount = parseFloat(document.getElementById('amount')?.value);
    const frequency = parseFloat(document.getElementById('frequency')?.value || 1);

    // Validation
    if (!amount || amount <= 0 || isNaN(amount)) {
        showToast('Please enter a valid amount', 'error');
        return;
    }

    if (!activity) {
        showToast('Please select an activity', 'error');
        return;
    }

    // Show loading
    const calculateBtn = document.querySelector('.btn-calculate');
    if (calculateBtn) {
        const originalText = calculateBtn.innerHTML;
        calculateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calculating...';
        calculateBtn.disabled = true;

        // Restore button after 3 seconds even if error
        setTimeout(() => {
            calculateBtn.innerHTML = originalText;
            calculateBtn.disabled = false;
        }, 3000);
    }

    // Prepare request
    const payload = {
        category: category,
        activity: activity,
        amount: amount * frequency
    };

    console.log('Sending request to:', `${API_BASE}/calculate`);
    console.log('Payload:', payload);

    // Make API call
    fetch(`${API_BASE}/calculate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('✅ Calculation successful:', data);
        showResult(data);
        showToast('Calculation saved successfully!', 'success');
        updateDashboard();
        loadHistory();
    })
    .catch(error => {
        console.error('❌ Calculation error:', error);
        showToast('Error: ' + error.message, 'error');
    })
    .finally(() => {
        // Restore button
        if (calculateBtn) {
            calculateBtn.innerHTML = '<i class="fas fa-bolt"></i> Calculate Emissions';
            calculateBtn.disabled = false;
        }
    });
}

function getActiveCategory() {
    const activeTab = document.querySelector('.category-tab.active');
    return activeTab ? activeTab.dataset.category : 'transport';
}

// ========== RESULT DISPLAY ==========
function showResult(data) {
    const resultDiv = document.getElementById('result-display');
    const equivalentsDiv = document.getElementById('equivalents');

    if (!resultDiv) {
        console.error('Result display not found');
        return;
    }

    const co2 = data.co2_kg || 0;
    const equivalents = calculateEquivalents(co2);

    // Update main result
    resultDiv.innerHTML = `
        <div class="result-content">
            <div class="result-main">
                <div class="co2-value">${co2.toFixed(2)} kg</div>
                <div class="co2-label">CO₂ Emissions</div>
            </div>
            <div class="result-details">
                <div class="detail-item">
                    <div class="detail-label">Category</div>
                    <div class="detail-value">${data.category || ''}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Activity</div>
                    <div class="detail-value">${data.activity || ''}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Amount</div>
                    <div class="detail-value">${data.amount || 0} ${data.unit || ''}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Factor</div>
                    <div class="detail-value">${data.factor_used || 0} kg/unit</div>
                </div>
            </div>
        </div>
    `;

    // Update equivalents
    if (equivalentsDiv) {
        equivalentsDiv.innerHTML = `
            <div class="equivalent-title">This is equivalent to:</div>
            <div class="equivalent-grid">
                <div class="equivalent-item">
                    <div class="equivalent-icon" style="background: linear-gradient(135deg, #10b981, #059669);">
                        <i class="fas fa-tree"></i>
                    </div>
                    <div class="equivalent-text">
                        <div class="equivalent-value">${equivalents.trees} trees</div>
                        <div class="equivalent-label">needed to absorb for 1 year</div>
                    </div>
                </div>
                <div class="equivalent-item">
                    <div class="equivalent-icon" style="background: linear-gradient(135deg, #3b82f6, #1d4ed8);">
                        <i class="fas fa-car"></i>
                    </div>
                    <div class="equivalent-text">
                        <div class="equivalent-value">${equivalents.carKm} km</div>
                        <div class="equivalent-label">by petrol car</div>
                    </div>
                </div>
                <div class="equivalent-item">
                    <div class="equivalent-icon" style="background: linear-gradient(135deg, #8b5cf6, #7c3aed);">
                        <i class="fas fa-mobile-alt"></i>
                    </div>
                    <div class="equivalent-text">
                        <div class="equivalent-value">${equivalents.smartphones}</div>
                        <div class="equivalent-label">smartphones charged</div>
                    </div>
                </div>
                <div class="equivalent-item">
                    <div class="equivalent-icon" style="background: linear-gradient(135deg, #ec4899, #db2777);">
                        <i class="fas fa-tv"></i>
                    </div>
                    <div class="equivalent-text">
                        <div class="equivalent-value">${equivalents.tvHours} hours</div>
                        <div class="equivalent-label">of TV watching</div>
                    </div>
                </div>
            </div>
        `;
    }
}

function calculateEquivalents(co2Kg) {
    return {
        trees: Math.round(co2Kg / 21.77),
        carKm: Math.round(co2Kg / 0.192),
        smartphones: Math.round(co2Kg / 0.008),
        tvHours: Math.round(co2Kg / 0.088)
    };
}

// ========== DASHBOARD FUNCTIONS ==========
function updateDashboard() {
    fetch(`${API_BASE}/stats`)
        .then(response => response.json())
        .then(data => {
            // Update hero stats
            if (data.total_emissions_kg) {
                document.getElementById('total-co2').textContent =
                    Math.round(data.total_emissions_kg) + ' kg';
                document.getElementById('trees-equivalent').textContent =
                    Math.round(data.equivalents?.trees_needed || 0);
                document.getElementById('total-calculations').textContent =
                    data.total_records || 0;
            }

            // Update impact stats
            if (data.summary) {
                document.getElementById('carbon-saved').textContent =
                    Math.round(data.summary.total_emissions_kg * 0.2) + ' kg';
                document.getElementById('car-equivalent').textContent =
                    Math.round(data.summary.total_emissions_kg / 0.192) + ' km';
                document.getElementById('solar-equivalent').textContent =
                    Math.round(data.summary.total_emissions_kg / 0.05) + ' kWh';
            }
        })
        .catch(err => console.warn('Error updating dashboard:', err));
}

// ========== HISTORY FUNCTIONS ==========
function loadHistory() {
    fetch(`${API_BASE}/history`)
        .then(response => response.json())
        .then(data => {
            const tbody = document.getElementById('history-table-body');
            if (!tbody) return;

            if (!data.records || data.records.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="empty-table">
                            <i class="fas fa-calculator fa-2x"></i>
                            <p>No calculations yet. Start calculating!</p>
                        </td>
                    </tr>
                `;
                return;
            }

            let html = '';
            data.records.forEach(record => {
                const date = new Date(record.timestamp).toLocaleDateString() + ' ' +
                            new Date(record.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

                html += `
                    <tr>
                        <td>${date}</td>
                        <td><span class="category-badge ${record.category}">${record.category}</span></td>
                        <td>${record.activity.replace('_', ' ')}</td>
                        <td>${record.amount} ${record.unit}</td>
                        <td><strong>${record.co2_kg.toFixed(2)} kg</strong></td>
                        <td>
                            <button class="btn-small" onclick="deleteRecord(${record.id})" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;
        })
        .catch(err => {
            console.warn('Error loading history:', err);
            const tbody = document.getElementById('history-table-body');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="empty-table">
                            <i class="fas fa-exclamation-triangle fa-2x"></i>
                            <p>Error loading history</p>
                        </td>
                    </tr>
                `;
            }
        });
}

function deleteRecord(id) {
    if (!confirm('Delete this calculation?')) return;

    showToast('Deleting record...', 'info');

    // Note: Your backend doesn't have delete endpoint yet
    // This is a placeholder for future implementation
    showToast('Delete feature coming soon!', 'info');
}
// In your .js or .html files:
fetch('/clear', { method: 'DELETE' })
// or
axios.delete('/clear')
// or
$.ajax({ url: '/clear', type: 'DELETE' })
function clearHistory() {
    if (!confirm('Clear ALL calculation history? This cannot be undone.')) return;

    fetch(`${API_BASE}/clear`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast('History cleared successfully', 'success');
            loadHistory();
            updateDashboard();
        }
    })
    .catch(err => {
        console.error('Error clearing history:', err);
        showToast('Clear feature coming soon!', 'info');
    });
}

// ========== UTILITY FUNCTIONS ==========
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) {
        console.warn('Toast element not found');
        // Create toast if it doesn't exist
        const toastEl = document.createElement('div');
        toastEl.id = 'toast';
        toastEl.className = 'toast';
        document.body.appendChild(toastEl);
    }

    const toastEl = document.getElementById('toast');
    toastEl.textContent = message;
    toastEl.className = 'toast show ' + type;

    setTimeout(() => {
        toastEl.className = 'toast';
    }, 3000);
}

function exportData() {
    showToast('Export feature coming soon!', 'info');
}

function toggleTheme() {
    document.body.classList.toggle('light-theme');
    const icon = document.querySelector('.theme-toggle i');
    if (icon) {
        if (document.body.classList.contains('light-theme')) {
            icon.className = 'fas fa-sun';
        } else {
            icon.className = 'fas fa-moon';
        }
    }
    showToast('Theme switched', 'info');
}

function showStats() {
    fetch(`${API_BASE}/stats`)
        .then(response => response.json())
        .then(data => {
            // Create modal content
            let html = `
                <div class="stats-modal">
                    <h3><i class="fas fa-chart-pie"></i> Detailed Statistics</h3>
                    
                    <div class="stats-summary">
                        <div class="stat-item">
                            <div class="stat-label">Total Emissions</div>
                            <div class="stat-value">${data.total_emissions_kg?.toFixed(2) || 0} kg CO₂</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Total Calculations</div>
                            <div class="stat-value">${data.total_records || 0}</div>
                        </div>
                    </div>
            `;

            if (data.breakdown) {
                html += `<h4>Category Breakdown</h4><div class="breakdown-grid">`;
                Object.entries(data.breakdown).forEach(([category, amount]) => {
                    const percentage = data.percentages?.[category] || 0;
                    html += `
                        <div class="breakdown-item ${category}">
                            <div class="breakdown-category">${category}</div>
                            <div class="breakdown-bar">
                                <div class="bar-fill" style="width: ${percentage}%"></div>
                            </div>
                            <div class="breakdown-numbers">
                                <span>${amount.toFixed(2)} kg</span>
                                <span>${percentage}%</span>
                            </div>
                        </div>
                    `;
                });
                html += `</div>`;
            }

            html += `</div>`;

            // Show in modal or alert
            alert('Statistics:\n' +
                  `Total CO₂: ${data.total_emissions_kg?.toFixed(2) || 0} kg\n` +
                  `Calculations: ${data.total_records || 0}\n` +
                  'View console for details');
            console.log('Detailed stats:', data);
        })
        .catch(err => {
            console.error('Error loading stats:', err);
            showToast('Error loading statistics', 'error');
        });
}

function showTip(category) {
    const tips = {
        transport: '🚗 Try carpooling, using public transport, or biking for short trips.',
        electricity: '💡 Turn off lights when not in use, use LED bulbs, unplug devices.',
        food: '🍎 Reduce meat consumption, buy local produce, minimize food waste.',
        waste: '🗑️ Recycle properly, compost organic waste, avoid single-use plastics.'
    };

    showToast(tips[category] || 'Reduce, Reuse, Recycle!', 'info');
}

// ========== GLOBAL FUNCTIONS (accessible from HTML) ==========
window.calculateEmission = calculateEmission;
window.loadHistory = loadHistory;
window.clearHistory = clearHistory;
window.showStats = showStats;
window.showTip = showTip;
window.checkApiStatus = checkApiStatus;
window.exportData = exportData;
window.toggleTheme = toggleTheme;
window.deleteRecord = deleteRecord;