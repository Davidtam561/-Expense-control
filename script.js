const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = null;
let expenses = [];
let userTags = [];
let customCategories = [];
let paymentMethods = [];
let pieChart = null;
let lineChart = null;
let paymentMethodChart = null;
let monthlyComparisonChart = null;
async function login() {
    const name = document.getElementById('nameInput').value.trim();
    const phone = document.getElementById('phoneInput').value.trim();
    const loginError = document.getElementById('loginError');
    if (!name || !phone) {
        showError(loginError, 'נא למלא את כל השדות');
        return;
    }
    try {
        showLoader(true);
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
            currentUser = user; }
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
        showNotification('התחברת בהצלחה!', 'success');
        await initializeApp();
    } catch (error) {
        showError(loginError, `שגיאה בהתחברות: ${error.message}`);
    } finally {
        showLoader(false);  }}
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
        initializeFilters();
    } catch (error) {
        showNotification('שגיאה בטעינת הנתונים', 'error');
        console.error('שגיאה באתחול:', error);
    } finally {
        showLoader(false); }}
async function loadExpenses() {
    try {
        const { data, error } = await supabase
            .from('expenses')
            .select(`
                *,
                payment_methods (name),
                expense_tags (
                    tags (name) ))
            .eq('user_id', currentUser.id)
            .order('date', { ascending: false });
        if (error) throw error;
        expenses = data;
    } catch (error) {
        showNotification('שגיאה בטעינת הוצאות', 'error');
        console.error('שגיאה בטעינת הוצאות:', error); }}
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
        console.error('שגיאה בטעינת קטגוריות:', error); }}
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
        console.error('שגיאה בטעינת אמצעי תשלום:', error); }}
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
        console.error('שגיאה בטעינת תגיות:', error); }}
async function loadUserPreferences() {
    try {
        const { data, error } = await supabase
            .from('user_preferences')
            .select('*')
            .eq('user_id', currentUser.id)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        if (data) {
            applyUserPreferences(data); }
    } catch (error) {
        console.error('שגיאה בטעינת העדפות:', error);   }}
function updateUI() {
    updateTable();
    updateCharts();
    updateFilters();}
function updateTable(filteredData = expenses) {
    const tbody = document.getElementById('expensesList');
    tbody.innerHTML = '';
    filteredData.forEach(expense => {
        const row = tbody.insertRow();
        row.insertCell().textContent = new Date(expense.date).toLocaleDateString('he-IL');
        row.insertCell().textContent = expense.category;
        const amountCell = row.insertCell();
        amountCell.textContent = formatCurrency(expense.amount);
        amountCell.classList.add('amount');
        row.insertCell().textContent = expense.payment_methods?.name || '';
        row.insertCell().textContent = expense.description || '';
        row.insertCell().textContent = expense.is_recurring ? 'כן' : 'לא';
        const tagsCell = row.insertCell();
        const tags = expense.expense_tags?.map(et => et.tags.name) || [];
        tagsCell.innerHTML = tags.map(tag => 
            `<span class="tag">${tag}</span>`
        ).join(''); });}
function updateCharts() {
    updatePieChart();
    updateLineChart();
    updatePaymentMethodChart();
    updateMonthlyComparisonChart();}
function updatePieChart() {
    const ctx = document.getElementById('pieChart').getContext('2d');
    const categoryTotals = getCategoryTotals();
    if (pieChart) {
        pieChart.destroy(); }
    pieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(categoryTotals),
            datasets: [{
                data: Object.values(categoryTotals),
                backgroundColor: getChartColors(Object.keys(categoryTotals).length)}]},
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        font: {
                            family: 'system-ui'  } } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${formatCurrency(value)} (${percentage}%)`; }  }  }       }  } });}
function updateLineChart() {
    const ctx = document.getElementById('lineChart').getContext('2d');
    const dailyTotals = getDailyTotals();
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
                fill: true,
                backgroundColor: 'rgba(54, 162, 235, 0.1)'}] },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatCurrency(value) }  } },
            interaction: {
                mode: 'index',
                intersect: false },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: context => formatCurrency(context.raw)             }  }}}});}
function updatePaymentMethodChart() {
    const ctx = document.getElementById('paymentMethodChart').getContext('2d');
    const methodTotals = getPaymentMethodTotals();
    if (paymentMethodChart) {
        paymentMethodChart.destroy();}
    paymentMethodChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(methodTotals),
            datasets: [{
                data: Object.values(methodTotals),
                backgroundColor: getChartColors(Object.keys(methodTotals).length) }] },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        font: {
                            family: 'system-ui' }} },
                tooltip: {
                    callbacks: {
                        label: context => formatCurrency(context.raw)} } } } });}
function updateMonthlyComparisonChart() {
    const ctx = document.getElementById('monthlyComparisonChart').getContext('2d');
    const monthlyTotals = getMonthlyTotals();
    const months = Object.keys(monthlyTotals).sort();
    if (monthlyComparisonChart) {
        monthlyComparisonChart.destroy();}
    monthlyComparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months.map(month => formatMonth(month)),
            datasets: [{
                label: 'סה"כ חודשי',
                data: months.map(month => monthlyTotals[month]),
                backgroundColor: '#36A2EB'}]},
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatCurrency(value) } } },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: context => formatCurrency(context.raw) } } }} });}
function formatCurrency(amount) {
    return new Intl.NumberFormat('he-IL', {
        style: 'currency',
        currency: 'ILS'
    }).format(amount);}
function formatMonth(monthStr) {
    const [year, month] = monthStr.split('-');
    return `${month}/${year}`;}
function getChartColors(count) {
    const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
        '#9966FF', '#FF9F40', '#FF6384', '#36A2EB' ];
    return colors.slice(0, count);}
function getCategoryTotals() {
    return expenses.reduce((acc, expense) => {
        acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
        return acc;}, {});}
function getDailyTotals() {
    return expenses.reduce((acc, expense) => {
        const date = expense.date.split('T')[0];
        acc[date] = (acc[date] || 0) + expense.amount;
        return acc;}, {});}
function getMonthlyTotals() {
    return expenses.reduce((acc, expense) => {
        const month = expense.date.substring(0, 7);
        acc[month] = (acc[month] || 0) + expense.amount;
        return acc; }, {});}
function getPaymentMethodTotals() {
    return expenses.reduce((acc, expense) => {
        const method = expense.payment_methods?.name || 'לא מוגדר';
        acc[method] = (acc[method] || 0) + expense.amount;
        return acc;}, {});}
function showLoader(show) {
    const loader = document.querySelector('.loading') || createLoader();
    loader.style.display = show ? 'flex' : 'none';}
function createLoader() {
    const loader = document.createElement('div');
    loader.className = 'loading';
    document.body.appendChild(loader);
    return loader;}
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.remove();
    }, 3000);}
function showError(element, message) {
    element.textContent = message;
    element.classList.remove('hidden');}
async function backupData() {
    try {
        showLoader(true);
        const userData = await collectUserData();
        downloadBackup(userData);
        localStorage.setItem('lastBackupDate', new Date().toISOString());
        showNotification('הגיבוי בוצע בהצלחה', 'success');
    } catch (error) {
        showNotification('שגיאה בביצוע הגיבוי', 'error');
        console.error('שגיאה בגיבוי:', error); } finally {
        showLoader(false);}}
async function collectUserData() {
    const { data: expenses } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', currentUser.id);
    const { data: categories } = await supabase
        .from('custom_categories')
        .select('*')
        .eq('user_id', currentUser.id);
    const { data: methods } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('user_id', currentUser.id);
    return {
        date: new Date().toISOString(),
        version: '1.0',
        user: currentUser,
        data: { expenses, categories, methods } };}
function downloadBackup(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], 
        { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expense_tracker_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);}
document.addEventListener('DOMContentLoaded', () => {
    checkLastBackup();
    initializeTheme();
    document.getElementById('amountInput')?.addEventListener('input', validateAmount);
    document.getElementById('categoryInput')?.addEventListener('change', validateForm);
    document.getElementById('paymentMethodInput')?.addEventListener('change', validateForm);});
function validateAmount(event) {
    const amount = event.target.value;
    if (amount < 0) {
        event.target.value = Math.abs(amount); }}
function validateForm() {
    const submitButton = document.querySelector('.expense-form button');
    const amount = document.getElementById('amountInput').value;
    const category = document.getElementById('categoryInput').value;
    const paymentMethod = document.getElementById('paymentMethodInput').value;
    submitButton.disabled = !amount || !category || !paymentMethod;}
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);}
function exportToExcel(reportType) {
    const workbook = XLSX.utils.book_new();
    const data = prepareExportData(reportType);
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(workbook, `expense_report_${reportType}_${new Date().toISOString().split('T')[0]}.xlsx`);}
function prepareExportData(reportType) {
    switch(reportType) {
        case 'monthly':
            return prepareMonthlyReport();
        case 'yearly':
            return prepareYearlyReport();
        case 'category':
            return prepareCategoryReport();
        default:
            return [];}}
