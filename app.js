// Конфигурация
// Если существует config.js, значения будут переопределены
let SPREADSHEET_ID = localStorage.getItem('spreadsheetId') || '';
let CLIENT_ID = '';
let API_KEY = '';

// Загрузка конфигурации из config.js если он существует
if (typeof CONFIG !== 'undefined') {
    CLIENT_ID = CONFIG.CLIENT_ID || '';
    API_KEY = CONFIG.API_KEY || '';
    if (CONFIG.SPREADSHEET_ID) {
        SPREADSHEET_ID = CONFIG.SPREADSHEET_ID;
    }
}

let DISCOVERY_DOCS = ['https://sheets.googleapis.com/$discovery/rest?version=v4'];
let SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

let gapiLoaded = false;
let gisLoaded = false;
let tokenClient = null;
let accessToken = null;
let currentMonth = new Date().toLocaleString('ru-RU', { month: 'long' }).toUpperCase();
let habits = [];
let completionChart = null;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('monthTitle').textContent = currentMonth;
    
    // Проверяем сохраненный ID таблицы
    if (SPREADSHEET_ID) {
        document.getElementById('spreadsheetId').value = SPREADSHEET_ID;
    }
    
    // Загружаем данные из localStorage
    loadHabitsFromStorage();
    
    // Показываем основной контент если есть привычки
    if (habits.length > 0) {
        document.getElementById('mainContent').style.display = 'block';
    }
    
    // Инициализируем Google API
    if (API_KEY) {
        gapi.load('client', initializeGapiClient);
    } else {
        console.log('API_KEY не настроен. Работаем в режиме localStorage.');
    }
    
    // Инициализируем Google Identity Services (если CLIENT_ID настроен)
    if (typeof google !== 'undefined' && CLIENT_ID) {
        try {
            google.accounts.id.initialize({
                client_id: CLIENT_ID,
                callback: handleCredentialResponse,
            });
            gisLoaded = true;
            // Обновляем data-client_id в HTML
            const gidOnload = document.getElementById('g_id_onload');
            if (gidOnload) {
                gidOnload.setAttribute('data-client_id', CLIENT_ID);
            }
        } catch (error) {
            console.error('Ошибка инициализации Google Identity:', error);
        }
    } else {
        // Скрываем кнопку авторизации если CLIENT_ID не настроен
        const authSection = document.getElementById('authSection');
        if (authSection) {
            const signInDiv = authSection.querySelector('.g_id_signin');
            if (signInDiv) {
                signInDiv.style.display = 'none';
            }
        }
    }
});

// Инициализация Google API Client
async function initializeGapiClient() {
    try {
        if (!API_KEY) {
            console.log('API_KEY не настроен. Приложение будет работать только с localStorage.');
            return;
        }
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: DISCOVERY_DOCS,
        });
        gapiLoaded = true;
        console.log('Google API загружен');
        
        // Если есть сохраненный ID таблицы, пытаемся загрузить данные
        if (SPREADSHEET_ID) {
            loadDataFromSheets();
        }
    } catch (error) {
        console.error('Ошибка загрузки Google API:', error);
    }
}

// Обработка авторизации через Google Identity Services
function handleCredentialResponse(response) {
    if (response.credential) {
        // Используем токен для доступа к API
        accessToken = response.credential;
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        loadDataFromSheets();
    }
}

// Установка ID таблицы
function setSpreadsheetId() {
    const id = document.getElementById('spreadsheetId').value.trim();
    if (id) {
        SPREADSHEET_ID = id;
        localStorage.setItem('spreadsheetId', id);
        
        // Показываем основной контент
        document.getElementById('mainContent').style.display = 'block';
        
        // Если API загружен, пытаемся загрузить данные
        if (gapiLoaded) {
            loadDataFromSheets();
        } else {
            // Иначе просто показываем интерфейс с данными из localStorage
            renderHabits();
            updateStats();
            updateChart();
        }
        
        alert('ID таблицы сохранен! ' + (gapiLoaded ? 'Попытка загрузки данных...' : 'Настройте API_KEY для синхронизации с Google Sheets.'));
    } else {
        alert('Введите ID таблицы');
    }
}

// Загрузка данных из Google Sheets
async function loadDataFromSheets() {
    if (!SPREADSHEET_ID || !gapiLoaded) {
        console.log('Таблица не настроена или API не загружен');
        // Показываем основной контент даже без Google Sheets
        document.getElementById('mainContent').style.display = 'block';
        return;
    }

    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'block';
    }

    try {
        // Загружаем данные из листа
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'A1:AF100',
        });

        const values = response.result.values;
        if (!values || values.length === 0) {
            console.log('Таблица пуста, используем данные из localStorage');
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            document.getElementById('mainContent').style.display = 'block';
            return;
        }

        // Парсим данные
        parseSheetData(values);
        renderHabits();
        updateStats();
        updateChart();
        
        // Сохраняем загруженные данные в localStorage
        saveHabitsToStorage();
        
        document.getElementById('mainContent').style.display = 'block';
    } catch (error) {
        console.error('Ошибка загрузки данных из Google Sheets:', error);
        // Используем данные из localStorage как резерв
        loadHabitsFromStorage();
        document.getElementById('mainContent').style.display = 'block';
        
        // Показываем предупреждение только если есть попытка подключения
        if (SPREADSHEET_ID) {
            console.warn('Не удалось загрузить данные из Google Sheets. Используются данные из браузера.');
        }
    } finally {
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }
}

// Парсинг данных из таблицы
function parseSheetData(values) {
    habits = [];
    
    // Ищем строку с заголовками (Habit Name, 1, 2, 3...)
    let headerRowIndex = -1;
    for (let i = 0; i < values.length; i++) {
        if (values[i] && values[i][0] === 'Habit Name') {
            headerRowIndex = i;
            break;
        }
    }

    if (headerRowIndex === -1) return;

    // Читаем привычки
    for (let i = headerRowIndex + 1; i < values.length; i++) {
        if (!values[i] || !values[i][0]) break;
        
        const habit = {
            name: values[i][0],
            days: []
        };

        // Читаем данные за каждый день (колонки 1-31)
        for (let day = 1; day <= 31; day++) {
            const value = values[i][day];
            habit.days[day - 1] = value === 'TRUE' || value === true;
        }

        habits.push(habit);
    }
}

// Сохранение данных в Google Sheets
async function saveToSheets() {
    // Всегда сохраняем в localStorage для надежности
    saveHabitsToStorage();
    
    if (!SPREADSHEET_ID || !gapiLoaded) {
        // Сохраняем только в localStorage если нет подключения к Sheets
        return;
    }

    try {
        // Подготавливаем данные для записи
        const values = prepareSheetData();
        
        if (values.length === 0) {
            return;
        }
        
        // Записываем данные асинхронно, не блокируя интерфейс
        gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: 'A6:AF100',
            valueInputOption: 'RAW',
            resource: {
                values: values
            }
        }).then(() => {
            console.log('Данные сохранены в Google Sheets');
        }).catch((error) => {
            console.error('Ошибка сохранения данных в Google Sheets:', error);
            // Данные уже сохранены в localStorage
        });

    } catch (error) {
        console.error('Ошибка подготовки данных для Google Sheets:', error);
        // Данные уже сохранены в localStorage
    }
}

// Подготовка данных для записи в таблицу
function prepareSheetData() {
    const values = [];
    
    habits.forEach(habit => {
        const row = [habit.name];
        for (let day = 0; day < 31; day++) {
            row.push(habit.days[day] ? 'TRUE' : 'FALSE');
        }
        values.push(row);
    });

    return values;
}

// Рендеринг привычек
function renderHabits() {
    const container = document.getElementById('habitsList');
    container.innerHTML = '';

    if (habits.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Нет привычек. Добавьте первую привычку!</p>';
        return;
    }

    habits.forEach((habit, index) => {
        const habitElement = createHabitElement(habit, index);
        container.appendChild(habitElement);
    });
}

// Создание элемента привычки
function createHabitElement(habit, index) {
    const div = document.createElement('div');
    div.className = 'habit-item';
    div.innerHTML = `
        <div class="habit-header">
            <div class="habit-name">
                <input type="text" value="${escapeHtml(habit.name)}" 
                       onchange="updateHabitName(${index}, this.value)">
            </div>
            <button class="btn-delete" onclick="deleteHabit(${index})">Удалить</button>
        </div>
        <div class="days-grid" id="days-${index}"></div>
    `;

    const daysGrid = div.querySelector(`#days-${index}`);
    
    // Создаем чекбоксы для каждого дня месяца
    const daysInMonth = getDaysInMonth();
    for (let day = 1; day <= daysInMonth; day++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'day-checkbox';
        const checked = habit.days[day - 1] ? 'checked' : '';
        dayDiv.innerHTML = `
            <label>${day}</label>
            <input type="checkbox" ${checked} 
                   onchange="updateHabitDay(${index}, ${day - 1}, this.checked)">
        `;
        daysGrid.appendChild(dayDiv);
    }

    return div;
}

// Получение количества дней в текущем месяце
function getDaysInMonth() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

// Обновление названия привычки
function updateHabitName(index, newName) {
    if (habits[index]) {
        habits[index].name = newName;
        saveToSheets();
    }
}

// Обновление дня привычки
function updateHabitDay(habitIndex, dayIndex, checked) {
    if (habits[habitIndex]) {
        habits[habitIndex].days[dayIndex] = checked;
        saveToSheets();
        updateStats();
        updateChart();
    }
}

// Добавление новой привычки
function addHabit() {
    const name = prompt('Введите название привычки:');
    if (name && name.trim()) {
        const newHabit = {
            name: name.trim(),
            days: new Array(31).fill(false)
        };
        habits.push(newHabit);
        renderHabits();
        saveToSheets();
        updateStats();
    }
}

// Удаление привычки
function deleteHabit(index) {
    if (confirm('Вы уверены, что хотите удалить эту привычку?')) {
        habits.splice(index, 1);
        renderHabits();
        saveToSheets();
        updateStats();
        updateChart();
    }
}

// Обновление статистики
function updateStats() {
    const habitCount = habits.length;
    document.getElementById('habitCount').textContent = habitCount;

    // Подсчет выполненных сегодня
    const today = new Date().getDate() - 1;
    let completedToday = 0;
    habits.forEach(habit => {
        if (habit.days[today]) {
            completedToday++;
        }
    });
    document.getElementById('completedToday').textContent = completedToday;

    // Обновление статистики по дням
    updateDailyStats();
}

// Обновление статистики по дням
function updateDailyStats() {
    const container = document.getElementById('dailyStats');
    container.innerHTML = '';

    const daysInMonth = getDaysInMonth();
    const stats = [];

    for (let day = 0; day < daysInMonth; day++) {
        let completed = 0;
        habits.forEach(habit => {
            if (habit.days[day]) {
                completed++;
            }
        });
        const percentage = habits.length > 0 ? (completed / habits.length * 100).toFixed(0) : 0;
        stats.push({ day: day + 1, percentage: percentage });
    }

    stats.forEach(stat => {
        const card = document.createElement('div');
        card.className = 'stat-card';
        card.innerHTML = `
            <div class="stat-card-day">День ${stat.day}</div>
            <div class="stat-card-value">${stat.percentage}%</div>
        `;
        container.appendChild(card);
    });
}

// Обновление графика
function updateChart() {
    const ctx = document.getElementById('completionChart').getContext('2d');
    const daysInMonth = getDaysInMonth();
    
    const labels = [];
    const data = [];

    for (let day = 0; day < daysInMonth; day++) {
        labels.push(`День ${day + 1}`);
        let completed = 0;
        habits.forEach(habit => {
            if (habit.days[day]) {
                completed++;
            }
        });
        const percentage = habits.length > 0 ? (completed / habits.length * 100) : 0;
        data.push(percentage);
    }

    if (completionChart) {
        completionChart.destroy();
    }

    completionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Процент выполнения',
                data: data,
                borderColor: '#34a853',
                backgroundColor: 'rgba(52, 168, 83, 0.2)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
}

// Сохранение в localStorage
function saveHabitsToStorage() {
    localStorage.setItem('habits', JSON.stringify(habits));
}

// Загрузка из localStorage
function loadHabitsFromStorage() {
    const saved = localStorage.getItem('habits');
    if (saved) {
        try {
            habits = JSON.parse(saved);
            renderHabits();
            updateStats();
            updateChart();
        } catch (e) {
            console.error('Ошибка загрузки из localStorage:', e);
        }
    }
}

// Экранирование HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Пропуск авторизации и начало использования
function skipAuth() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    // Если есть сохраненные привычки, они уже загружены
    if (habits.length === 0) {
        renderHabits();
    }
}

// Экспорт функций для использования в HTML
window.addHabit = addHabit;
window.deleteHabit = deleteHabit;
window.updateHabitName = updateHabitName;
window.updateHabitDay = updateHabitDay;
window.setSpreadsheetId = setSpreadsheetId;
window.handleCredentialResponse = handleCredentialResponse;
window.skipAuth = skipAuth;

