const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = 'YOUR_SUPABASE_KEY';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = null;
let expenses = [];
let userTags = [];
let customCategories = [];
let paymentMethods = [];
let pieChart = null;
let lineChart = null;
let paymentMethodChart = null;
let monthlyComparisonChart = null;
document.addEventListener('DOMContentLoaded', () => {
    checkLastBackup();
    initializeTheme();
});
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}
function checkLastBackup() {
    const lastBackup = localStorage.getItem('lastBackupDate');
    if (lastBackup) {
        const lastBackupDate = new Date(lastBackup);
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        if (lastBackupDate < monthAgo) {
            showNotification('לא בוצע גיבוי בחודש האחרון! מומלץ לבצע גיבוי.', 'warning');
        }
    }
}
async function login() {
    const name = document.getElementById('nameInput').value.trim();
    const phone = document.getElementById('phoneInput').value.trim();
    const loginError = document.getElementById('loginError');
    if (!name || !phone) {
        showError(loginError, 'נא למלא את כל השדות');
        return;
    }
    try {
        let { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('phone', phone)
            .single();
        if (error && error.code !== 'PGRST116') {
            throw error;
        }
        if (!user) {
            const { data, error: insertError } = await supabase
                .from('users')
                .insert([{ name, phone }])
                .single();
            if (insertError) throw insertError;
            currentUser = data;
        } else {
            currentUser = user;
        }
        showSuccess('התחברות בוצעה בהצלחה');
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
        await initializeApp();
    } catch (error) {
        showError(loginError, `שגיאה בהתחברות: ${error.message}`);
    }
}
async function initializeApp() {
    showLoader(true);
    try {
        await Promise.all([
            loadUserPreferences(),
            loadCustomCategories(),
            loadPaymentMethods(),
            loadTags(),
            loadExpenses()
        ]);
        updateUI();
    } catch (error) {
        showNotification('שגיאה בטעינת הנתונים', 'error');
        console.error('שגיאה באתחול:', error);
    } finally {
        showLoader(false);
    }
}
async function loadUserPreferences() {
    try {
        const { data, error } = await supabase
            .from('user_preferences')
            .select('*')
            .eq('user_id', currentUser.id)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        if (data) {
            applyUserPreferences(data);
        }
    } catch (error) {
        console.error('שגיאה בטעינת העדפות:', error);
    }
}
function applyUserPreferences(preferences) {
    if (preferences.theme) {
        document.documentElement.setAttribute('data-theme', preferences.theme);
    }
}// פונקציות טעינת נתונים נוספות
async function loadExpenses() {
    try {
        const { data, error } = await supabase
            .from('expenses')
            .select(`
                *,
                payment_methods (name),
                expense_tags (
                    tags (name)
                )
            `)
            .eq('user_id', currentUser.id)
            .order('date', { ascending: false });
        if (error) throw error;
        expenses = data;
    } catch (error) {
        showNotification('שגיאה בטעינת הוצאות', 'error');
        console.error('שגיאה בטעינת הוצאות:', error);
    }
}
async function loadCustomCategories() {
    try {
        const { data, error } = await supabase
            .from('custom_categories')
            .select('*')
            .eq('user_id', currentUser.id);
        if (error) throw error;
        customCategories = data;
        updateCategoryDropdowns();
    } catch (error) {
        console.error('שגיאה בטעינת קטגוריות:', error);
    }
}
async function loadPaymentMethods() {
    try {
        const { data, error } = await supabase
            .from('payment_methods')
            .select('*')
            .eq('user_id', currentUser.id);
        if (error) throw error;
        paymentMethods = data;
        updatePaymentMethodDropdowns();
    } catch (error) {
        console.error('שגיאה בטעינת אמצעי תשלום:', error);
    }
}
async function loadTags() {
    try {
        const { data, error } = await supabase
            .from('tags')
            .select('*')
            .eq('user_id', currentUser.id);
        if (error) throw error;
        userTags = data;
        updateTagsUI();
    } catch (error) {
        console.error('שגיאה בטעינת תגיות:', error);  }}
function updateUI() {
    updateTable();
    updateCharts();
    updateFilters();
    updateMonthSelect();}
function updateTable(filteredData = expenses) {
    const tbody = document.getElementById('expensesList');
    tbody.innerHTML = '';
    filteredData.forEach(expense => {
        const row = tbody.insertRow();
        const dateCell = row.insertCell();
        const date = new Date(expense.date);
        dateCell.textContent = date.toLocaleDateString('he-IL');
        row.insertCell().textContent = expense.category;
        const amountCell = row.insertCell();
        amountCell.textContent = `₪${expense.amount.toFixed(2)}`;
        amountCell.classList.add('amount');
        row.insertCell().textContent = expense.payment_methods?.name || '';
        row.insertCell().textContent = expense.description || '';
        row.insertCell().textContent = expense.is_recurring ? 'כן' : 'לא';
        const tagsCell = row.insertCell();
        const tags = expense.expense_tags?.map(et => et.tags.name) || [];
        tagsCell.innerHTML = tags.map(tag => 
            `<span class="tag">${tag}</span>`
        ).join('');  });}
function updateCategoryDropdowns() {
    const categorySelect = document.getElementById('categoryInput');
    const filterSelect = document.getElementById('categoryFilter');
    const customGroup = document.getElementById('customCategoriesGroup');
    customGroup.innerHTML = '';
    customCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.name;
        option.textContent = category.name;
        customGroup.appendChild(option);
        const filterOption = option.cloneNode(true);
        filterSelect.appendChild(filterOption);  });}
function updatePaymentMethodDropdowns() {
    const paymentSelect = document.getElementById('paymentMethodInput');
    const filterSelect = document.getElementById('paymentMethodFilter');
    paymentSelect.innerHTML = '<option value="">בחר אמצעי תשלום</option>';
    filterSelect.innerHTML = '<option value="">כל אמצעי התשלום</option>';
    paymentMethods.forEach(method => {
        const option = document.createElement('option');
        option.value = method.id;
        option.textContent = method.name;
        paymentSelect.appendChild(option);
        const filterOption = option.cloneNode(true);
        filterSelect.appendChild(filterOption);  });}
function updateTagsUI() {
    const container = document.getElementById('tagsContainer');
    container.innerHTML = userTags.map(tag => `
        <span class="tag" data-id="${tag.id}" onclick="toggleTag(this)">
            ${tag.name}
        </span>
    `).join('');}
function showLoader(show) {}
function showNotification(message, type = 'info') {}
function showError(element, message) {
    element.textContent = message;
    element.classList.remove('hidden');}
function showSuccess(message) {}
function toggleTag(tagElement) {
    tagElement.classList.toggle('selected');}
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('amountInput').addEventListener('input', validateAmount);
    document.getElementById('categoryInput').addEventListener('change', validateForm);
    document.getElementById('paymentMethodInput').addEventListener('change', validateForm);});
function validateAmount(event) {
    const amount = event.target.value;
    if (amount < 0) {
        event.target.value = Math.abs(amount);  }}
function validateForm() {
    const submitButton = document.querySelector('.expense-form button');
    const amount = document.getElementById('amountInput').value;
    const category = document.getElementById('categoryInput').value;
    const paymentMethod = document.getElementById('paymentMethodInput').value;
    submitButton.disabled = !amount || !category || !paymentMethod;}// פונקציות גרפים
function updateCharts() {
    const selectedMonth = document.getElementById('monthSelect').value;
    const filteredExpenses = selectedMonth ? 
        expenses.filter(e => e.date.startsWith(selectedMonth)) : expenses;
    updatePieChart(filteredExpenses);
    updateLineChart(filteredExpenses);
    updatePaymentMethodChart(filteredExpenses);
    updateMonthlyComparisonChart();}
function updatePieChart(filteredExpenses) {
    const ctx = document.getElementById('pieChart').getContext('2d');
    const categoryTotals = getCategoryTotals(filteredExpenses);
    if (pieChart) {
        pieChart.destroy(); }
    pieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(categoryTotals),
            datasets: [{
                data: Object.values(categoryTotals),
                backgroundColor: getChartColors(Object.keys(categoryTotals).length)   }] },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        font: {
                            family: 'system-ui'  }  }  },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `₪${value.toFixed(2)} (${percentage}%)`;   }  } }    }   }   });}
function updateLineChart(filteredExpenses) {
    const ctx = document.getElementById('lineChart').getContext('2d');
    const dailyTotals = getDailyTotals(filteredExpenses);
    const sortedDates = Object.keys(dailyTotals).sort();
    if (lineChart) {
        lineChart.destroy(); }
    lineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedDates.map(date => new Date(date).toLocaleDateString('he-IL')),
            datasets: [{
                label: 'הוצאות יומיות',
                data: sortedDates.map(date => dailyTotals[date]),
                borderColor: '#36A2EB',
                tension: 0.4,
                fill: true }] },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => `₪${value.toFixed(0)}` } } },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `₪${context.raw.toFixed(2)}`; }   }         }   } } });}
function updatePaymentMethodChart(filteredExpenses) {
    const ctx = document.getElementById('paymentMethodChart').getContext('2d');
    const methodTotals = getPaymentMethodTotals(filteredExpenses);
    if (paymentMethodChart) {
        paymentMethodChart.destroy(); }
    paymentMethodChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(methodTotals),
            datasets: [{
                data: Object.values(methodTotals),
                backgroundColor: getChartColors(Object.keys(methodTotals).length) }]},
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        font: {
                            family: 'system-ui' } } } } } });}
function updateMonthlyComparisonChart() {
    const ctx = document.getElementById('monthlyComparisonChart').getContext('2d');
    const monthlyTotals = getMonthlyTotals();
    const months = Object.keys(monthlyTotals).sort();
    if (monthlyComparisonChart) {
        monthlyComparisonChart.destroy();  }
    monthlyComparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months.map(month => formatMonth(month)),
            datasets: [{
                label: 'סה"כ חודשי',
                data: months.map(month => monthlyTotals[month]),
                backgroundColor: '#36A2EB' }] },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => `₪${value.toFixed(0)}` } }},
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `₪${context.raw.toFixed(2)}`; } } }} } });}
function getChartColors(count) {
    const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
        '#9966FF', '#FF9F40', '#FF6384', '#36A2EB'];
    return colors.slice(0, count);}
function getCategoryTotals(expenses) {
    return expenses.reduce((acc, expense) => {
        acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
        return acc; }, {});}
function getDailyTotals(expenses) {
    return expenses.reduce((acc, expense) => {
        const date = expense.date.split('T')[0];
        acc[date] = (acc[date] || 0) + expense.amount;
        return acc; }, {});}
function getPaymentMethodTotals(expenses) {
    return expenses.reduce((acc, expense) => {
        const method = expense.payment_methods?.name || 'לא מוגדר';
        acc[method] = (acc[method] || 0) + expense.amount;
        return acc;}, {});}
function getMonthlyTotals() {
    return expenses.reduce((acc, expense) => {
        const month = expense.date.substring(0, 7);
        acc[month] = (acc[month] || 0) + expense.amount;
        return acc; }, {});}
function formatMonth(monthStr) {
    const [year, month] = monthStr.split('-');
    return `${month}/${year}`;}
function formatCurrency(amount) {
    return new Intl.NumberFormat('he-IL', {
        style: 'currency',
        currency: 'ILS'
    }).format(amount);}
function updateMonthSelect() {
    const monthSelect = document.getElementById('monthSelect');
    const months = [...new Set(expenses.map(e => e.date.substring(0, 7)))].sort();
    monthSelect.innerHTML = '<option value="">כל החודשים</option>' +
        months.map(month => `<option value="${month}">${formatMonth(month)}</option>`).join('');}
window.onload = function() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        initializeApp();}};
