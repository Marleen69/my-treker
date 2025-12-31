/**
 * Скрипт для автоматической настройки трекера привычек в Google Sheets
 * 
 * Инструкция:
 * 1. Откройте Google Sheets и создайте новый лист
 * 2. Откройте Extensions > Apps Script
 * 3. Вставьте этот код
 * 4. Измените название месяца в функции setupHabitTracker() если нужно
 * 5. Нажмите Run > setupHabitTracker
 */

function setupHabitTracker() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const monthName = "NOVEMBER"; // Измените здесь название месяца
  
  // Очистка листа
  sheet.clear();
  
  // Установка заголовка месяца
  sheet.getRange(1, 1).setValue(monthName);
  sheet.getRange(1, 1).setFontSize(18);
  sheet.getRange(1, 1).setFontWeight("bold");
  
  // Пустая строка
  sheet.getRange(2, 1).setValue("");
  
  // Статистика сверху
  const firstHabitRow = headerRow + 1;
  sheet.getRange(3, 1).setValue("Number of Habits:");
  sheet.getRange(3, 2).setFormula(`=COUNTA(A${firstHabitRow}:A100)`);
  sheet.getRange(4, 1).setValue("Completed Habits Today:");
  const lastColumn = getColumnLetter(daysInMonth + 1);
  sheet.getRange(4, 2).setFormula(`=COUNTIF(B${firstHabitRow}:${lastColumn}100,TRUE)`);
  
  // Форматирование статистики
  sheet.getRange(3, 1, 2, 1).setFontWeight("bold");
  
  // Пустая строка
  sheet.getRange(5, 1).setValue("");
  
  // Заголовки таблицы привычек
  const headerRow = 6;
  sheet.getRange(headerRow, 1).setValue("Habit Name");
  sheet.getRange(headerRow, 1).setFontWeight("bold");
  
  // Создание заголовков дат (1-31)
  const daysInMonth = 31; // Можно настроить для разных месяцев
  for (let day = 1; day <= daysInMonth; day++) {
    sheet.getRange(headerRow, day + 1).setValue(day);
    sheet.getRange(headerRow, day + 1).setFontWeight("bold");
  }
  
  // Примеры привычек
  const exampleHabits = [
    "Example Habit 1",
    "Example Habit 2",
    "Example Habit 3"
  ];
  
  // Добавление примеров привычек с чекбоксами
  let habitRow = headerRow + 1;
  for (let i = 0; i < exampleHabits.length; i++) {
    sheet.getRange(habitRow + i, 1).setValue(exampleHabits[i]);
    
    // Создание чекбоксов для каждого дня
    for (let day = 1; day <= daysInMonth; day++) {
      const checkboxRange = sheet.getRange(habitRow + i, day + 1);
      checkboxRange.insertCheckboxes();
      checkboxRange.setValue(false);
    }
  }
  
  // Пустая строка перед статистикой
  const statsStartRow = habitRow + exampleHabits.length + 1;
  sheet.getRange(statsStartRow, 1).setValue("");
  
  // Заголовок блока статистики
  sheet.getRange(statsStartRow + 1, 1).setValue("Statistics");
  sheet.getRange(statsStartRow + 1, 1).setFontSize(14);
  sheet.getRange(statsStartRow + 1, 1).setFontWeight("bold");
  
  // Заголовки статистики
  sheet.getRange(statsStartRow + 2, 1).setValue("Day");
  sheet.getRange(statsStartRow + 3, 1).setValue("Completion %");
  sheet.getRange(statsStartRow + 2, 1).setFontWeight("bold");
  sheet.getRange(statsStartRow + 3, 1).setFontWeight("bold");
  
  // Заполнение дней в статистике
  const firstHabitRowForStats = headerRow + 1;
  for (let day = 1; day <= daysInMonth; day++) {
    sheet.getRange(statsStartRow + 2, day + 1).setValue(day);
    
    // Формула для расчета процента выполнения за день
    const columnLetter = getColumnLetter(day + 1);
    const formula = `=IF(COUNTA($A$${firstHabitRowForStats}:$A$100)=0,0,COUNTIF($${columnLetter}$${firstHabitRowForStats}:$${columnLetter}$100,TRUE)/COUNTA($A$${firstHabitRowForStats}:$A$100)*100)`;
    sheet.getRange(statsStartRow + 3, day + 1).setFormula(formula);
    sheet.getRange(statsStartRow + 3, day + 1).setNumberFormat("0.0%");
  }
  
  // Создание графика
  createChart(sheet, statsStartRow + 2, statsStartRow + 3, daysInMonth);
  
  // Настройка ширины колонок
  sheet.setColumnWidth(1, 150);
  for (let day = 1; day <= daysInMonth; day++) {
    sheet.setColumnWidth(day + 1, 50);
  }
  
  // Заморозка строки заголовков
  sheet.setFrozenRows(headerRow);
  
  // Заморозка колонки с названиями привычек
  sheet.setFrozenColumns(1);
}

/**
 * Вспомогательная функция для получения буквы колонки по номеру
 */
function getColumnLetter(columnNumber) {
  let result = '';
  while (columnNumber > 0) {
    columnNumber--;
    result = String.fromCharCode(65 + (columnNumber % 26)) + result;
    columnNumber = Math.floor(columnNumber / 26);
  }
  return result;
}

/**
 * Создание графика выполнения привычек
 */
function createChart(sheet, headerRow, dataRow, daysInMonth) {
  const chartRow = dataRow + 3;
  
  // Создание диапазона данных для графика (заголовки + данные)
  const chartRange = sheet.getRange(headerRow, 1, 2, daysInMonth + 1);
  
  const chartBuilder = sheet.newChart()
    .setChartType(Charts.ChartType.AREA)
    .addRange(chartRange)
    .setPosition(chartRow, 1, 0, 0)
    .setOption('title', 'Habit Completion by Day')
    .setOption('legend.position', 'none')
    .setOption('colors', ['#34a853']) // Зеленый цвет
    .setOption('areaOpacity', 0.6)
    .setOption('hAxis.title', 'Day')
    .setOption('vAxis.title', 'Completion %')
    .setOption('vAxis.format', '#%')
    .setOption('width', 800)
    .setOption('height', 300);
  
  sheet.insertChart(chartBuilder.build());
}

/**
 * Функция для добавления новой привычки
 */
function addHabit(habitName) {
  const sheet = SpreadsheetApp.getActiveSheet();
  
  // Находим первую пустую строку в колонке A после заголовков
  const headerRow = 6;
  let lastRow = sheet.getLastRow();
  let newRow = lastRow + 1;
  
  // Если таблица пустая, начинаем с первой строки после заголовка
  if (lastRow < headerRow) {
    newRow = headerRow + 1;
  }
  
  // Добавляем название привычки
  sheet.getRange(newRow, 1).setValue(habitName);
  
  // Добавляем чекбоксы для всех дней месяца
  const daysInMonth = 31;
  for (let day = 1; day <= daysInMonth; day++) {
    const checkboxRange = sheet.getRange(newRow, day + 1);
    checkboxRange.insertCheckboxes();
    checkboxRange.setValue(false);
  }
}

/**
 * Функция для удаления привычки по имени
 */
function removeHabit(habitName) {
  const sheet = SpreadsheetApp.getActiveSheet();
  const headerRow = 6;
  const dataRange = sheet.getRange(headerRow + 1, 1, sheet.getLastRow() - headerRow, 1);
  const values = dataRange.getValues();
  
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === habitName) {
      sheet.deleteRow(headerRow + 1 + i);
      break;
    }
  }
}

