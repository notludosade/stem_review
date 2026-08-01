(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.STEMPythonProject = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const round = (value) => Number(value.toFixed(2));
  const normalizeSensorId = (sensorId) => sensorId.trim().toUpperCase().replace(/[-\s]+/g, '_').replace(/^_+|_+$/g, '');
  const validTimestamp = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value.replace(' ', 'T')}:00Z`);
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 16).replace('T', ' ') === value;
  };
  const validReading = (record) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
    const numeric = (value) => typeof value === 'number' && Number.isFinite(value);
    return typeof record.sensor === 'string' && normalizeSensorId(record.sensor) !== ''
      && numeric(record.temperature_c) && record.temperature_c >= -80 && record.temperature_c <= 80
      && numeric(record.pm25) && record.pm25 >= 0
      && validTimestamp(record.timestamp) && typeof record.active === 'boolean';
  };
  const celsiusToFahrenheit = (temperature) => round(temperature * 9 / 5 + 32);
  const airQualityBand = (pm25) => {
    if (pm25 <= 12) return 'Good';
    if (pm25 <= 35.4) return 'Moderate';
    if (pm25 <= 55.4) return 'Unhealthy for Sensitive Groups';
    if (pm25 <= 150.4) return 'Unhealthy';
    if (pm25 <= 250.4) return 'Very Unhealthy';
    return 'Hazardous';
  };
  const normalizeReading = (record) => ({
    sensor: normalizeSensorId(record.sensor),
    temperature_c: round(record.temperature_c),
    temperature_f: celsiusToFahrenheit(record.temperature_c),
    pm25: round(record.pm25),
    air_quality: airQualityBand(record.pm25),
    timestamp: record.timestamp,
    active: record.active
  });
  const activeReadings = (records) => records.filter((record) => validReading(record) && record.active).map(normalizeReading)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.sensor.localeCompare(b.sensor));
  const sensorStatistics = (records) => {
    const groups = {};
    activeReadings(records).forEach((record) => { (groups[record.sensor] ||= []).push(record); });
    return Object.fromEntries(Object.keys(groups).sort().map((sensor) => {
      const readings = groups[sensor];
      return [sensor, {
        reading_count: readings.length,
        average_temperature_c: round(readings.reduce((sum, item) => sum + item.temperature_c, 0) / readings.length),
        average_pm25: round(readings.reduce((sum, item) => sum + item.pm25, 0) / readings.length),
        maximum_pm25: round(Math.max(...readings.map((item) => item.pm25)))
      }];
    }));
  };
  const longestAlertStreak = (records, threshold = 35.4) => {
    const groups = {};
    activeReadings(records).forEach((record) => { (groups[record.sensor] ||= []).push(record); });
    return Object.fromEntries(Object.keys(groups).sort().map((sensor) => {
      let best = 0, run = 0;
      groups[sensor].forEach((record) => { run = record.pm25 > threshold ? run + 1 : 0; best = Math.max(best, run); });
      return [sensor, best];
    }));
  };
  const environmentReport = (records) => {
    const readings = activeReadings(records);
    const sensors = sensorStatistics(records);
    const ranked = Object.entries(sensors).sort((a, b) => b[1].maximum_pm25 - a[1].maximum_pm25 || a[0].localeCompare(b[0]));
    return {
      reading_count: readings.length,
      readings,
      sensors,
      alerts: longestAlertStreak(records),
      overall_average_pm25: readings.length ? round(readings.reduce((sum, item) => sum + item.pm25, 0) / readings.length) : 0,
      highest_risk_sensor: ranked.length ? ranked[0][0] : null
    };
  };

  const READING_SETS = [
    [
      { sensor: ' lab-1 ', temperature_c: 20, pm25: 10, timestamp: '2026-01-01 09:00', active: true },
      { sensor: 'lab-1', temperature_c: 22, pm25: 42, timestamp: '2026-01-01 10:00', active: true },
      { sensor: 'lab 1', temperature_c: 21.25, pm25: 55, timestamp: '2026-01-01 11:00', active: true },
      { sensor: 'roof-2', temperature_c: -5, pm25: 60, timestamp: '2026-01-01 09:30', active: false },
      { sensor: 'roof 2', temperature_c: 5, pm25: 36, timestamp: '2026-01-01 11:30', active: true }
    ],
    [
      { sensor: 'north', temperature_c: 12, pm25: 60, timestamp: '2026-02-10 08:00', active: true },
      { sensor: 'north', temperature_c: 13, pm25: 10, timestamp: '2026-02-10 09:00', active: true },
      { sensor: 'north', temperature_c: 14, pm25: 70, timestamp: '2026-02-10 10:00', active: true },
      { sensor: 'north', temperature_c: 15, pm25: 80, timestamp: '2026-02-10 11:00', active: true },
      { sensor: 'south', temperature_c: 25, pm25: 250.4, timestamp: '2026-02-10 09:30', active: true },
      { sensor: 'south', temperature_c: 26, pm25: 251, timestamp: '2026-02-10 10:30', active: true }
    ],
    [
      { sensor: '', temperature_c: 20, pm25: 4, timestamp: '2026-03-01 08:00', active: true },
      { sensor: 'unit-12', temperature_c: 100, pm25: 4, timestamp: '2026-03-01 08:30', active: true },
      { sensor: 'unit-12', temperature_c: 18, pm25: -1, timestamp: '2026-03-01 09:00', active: true },
      { sensor: 'unit-12', temperature_c: 18, pm25: 0, timestamp: 'bad date', active: true },
      { sensor: 'unit-12', temperature_c: 18, pm25: 0, timestamp: '2026-03-01 10:00', active: true },
      { sensor: 'unit 12', temperature_c: 20, pm25: 35.4, timestamp: '2026-03-01 11:00', active: true }
    ],
    []
  ];
  const test = (args, expected) => ({ args: clone(args), expected: clone(expected) });
  const concepts = (...items) => items.map(([label, ...patterns]) => ({ label, patterns }));
  const tasks = [
    {
      title: 'Normalize Sensor IDs', entry: 'normalize_sensor_id', entryType: 'function', course: 'Computer Programming 1',
      prompt: 'Implement normalize_sensor_id(sensor_id). Strip outside whitespace, uppercase the text, and replace each run of spaces or hyphens with one underscore.',
      requirements: ['Return a string.', 'Remove leading and trailing separators.', 'Whitespace-only input becomes an empty string.'],
      hint: 'Replace hyphens with spaces, then split and join the pieces.', maxLines: 6, runtimeBudgetMs: 8,
      concepts: concepts(['Function', '^def\\s+normalize_sensor_id'], ['String cleanup', '\\.strip\\s*\\(', '\\.split\\s*\\(', '\\.upper\\s*\\('], ['Joining', '\\.join\\s*\\(']),
      tests: [' lab-1 ', 'roof  2', '--north-wing--', ' Unit - 12 ', '   '].map((value) => test([value], normalizeSensorId(value)))
    },
    {
      title: 'Validate Field Readings', entry: 'validate_reading', entryType: 'function', course: 'Computer Programming 1',
      prompt: 'Implement validate_reading(record). Confirm sensor, temperature_c, pm25, timestamp, and active contain usable field data.',
      requirements: ['temperature_c is a non-boolean number from -80 through 80.', 'pm25 is a non-boolean number at least 0.', 'timestamp must parse exactly as YYYY-MM-DD HH:MM; active must be bool.'],
      hint: 'Check fields and types first, then use datetime.strptime inside try/except.', maxLines: 22, runtimeBudgetMs: 12,
      concepts: concepts(['Function', '^def\\s+validate_reading'], ['Type checks', 'isinstance\\s*\\(', 'type\\s*\\('], ['Branching', 'if\\s+'], ['Date validation', 'datetime\\.strptime', 'try:']),
      tests: [
        READING_SETS[0][0],
        { sensor: 'edge', temperature_c: -80, pm25: 0, timestamp: '2024-02-29 23:59', active: false },
        { sensor: 'bad', temperature_c: 81, pm25: 1, timestamp: '2026-01-01 00:00', active: true },
        { sensor: 'bad', temperature_c: 20, pm25: -1, timestamp: '2026-01-01 00:00', active: true },
        { sensor: 'bad', temperature_c: 20, pm25: 1, timestamp: '2026/01/01', active: true },
        { sensor: 'bad', temperature_c: true, pm25: 1, timestamp: '2026-01-01 00:00', active: true }
      ].map((record) => test([record], validReading(record)))
    },
    {
      title: 'Convert Temperatures', entry: 'celsius_to_fahrenheit', entryType: 'function', course: 'Computer Programming 1',
      prompt: 'Implement celsius_to_fahrenheit(temperature_c). Convert Celsius to Fahrenheit and round the final value to two decimals.',
      requirements: ['Use F = C × 9/5 + 32.', 'Round only the final result.', 'Return a number.'],
      hint: 'This is one arithmetic expression inside round.', maxLines: 4, runtimeBudgetMs: 6,
      concepts: concepts(['Function', '^def\\s+celsius_to_fahrenheit'], ['Arithmetic', '\\*', '\\+'], ['Rounding', 'round\\s*\\(']),
      tests: [-40, 0, 20, 37.25, 80].map((value) => test([value], celsiusToFahrenheit(value)))
    },
    {
      title: 'Classify Air Quality', entry: 'air_quality_band', entryType: 'function', course: 'Computer Programming 1',
      prompt: 'Implement air_quality_band(pm25) using the EPA-style boundaries supplied below.',
      requirements: ['Return Good through 12; Moderate through 35.4; Unhealthy for Sensitive Groups through 55.4.', 'Return Unhealthy through 150.4; Very Unhealthy through 250.4; otherwise Hazardous.', 'Test boundaries from lowest to highest.'],
      hint: 'Use an if/elif chain; after a threshold fails, the next branch only needs its upper bound.', maxLines: 16, runtimeBudgetMs: 8,
      concepts: concepts(['Function', '^def\\s+air_quality_band'], ['Branching', 'if\\s+', 'elif\\s+'], ['Threshold comparison', '<=']),
      tests: [0, 12, 12.1, 35.4, 55.4, 150.4, 250.4, 250.41].map((value) => test([value], airQualityBand(value)))
    },
    {
      title: 'Normalize Complete Readings', entry: 'normalize_reading', entryType: 'function', course: 'Computer Programming 2',
      prompt: 'Implement normalize_reading(record). Build a clean dictionary using your sensor, conversion, and air-quality helpers.',
      requirements: ['Return exactly sensor, temperature_c, temperature_f, pm25, air_quality, timestamp, and active.', 'Round both numeric reading fields to two decimals.', 'Do not mutate the input dictionary.'],
      hint: 'Return one new dictionary and call the three earlier helpers.', maxLines: 16, runtimeBudgetMs: 12,
      concepts: concepts(['Dictionary construction', '\\{[\\s\\S]*\\}'], ['Helper reuse', 'normalize_sensor_id\\s*\\(', 'celsius_to_fahrenheit\\s*\\(', 'air_quality_band\\s*\\('], ['Rounding', 'round\\s*\\(']),
      tests: [READING_SETS[0][0], READING_SETS[0][2], READING_SETS[1][4], READING_SETS[2][5]].map((record) => test([record], normalizeReading(record)))
    },
    {
      title: 'Clean and Order Active Data', entry: 'active_readings', entryType: 'function', course: 'Computer Programming 2',
      prompt: 'Implement active_readings(records). Keep only valid active records, normalize them, then sort by timestamp and sensor.',
      requirements: ['Invalid and inactive records are excluded.', 'Return a new list without mutating records.', 'Timestamp is the primary sort key; sensor resolves ties.'],
      hint: 'A filtered comprehension plus sorted with a tuple key works well.', maxLines: 12, runtimeBudgetMs: 18,
      concepts: concepts(['Collection transformation', 'for\\s+', 'map\\s*\\('], ['Filtering', 'if\\s+', 'filter\\s*\\('], ['Sorting', 'sorted\\s*\\(', '\\.sort\\s*\\('], ['Helper reuse', 'validate_reading\\s*\\(', 'normalize_reading\\s*\\(']),
      tests: READING_SETS.map((records) => test([records], activeReadings(records)))
    },
    {
      title: 'Calculate Sensor Statistics', entry: 'sensor_statistics', entryType: 'function', course: 'Computer Programming 2',
      prompt: 'Implement sensor_statistics(records). Group cleaned readings by sensor and calculate count, average temperature, average PM2.5, and maximum PM2.5.',
      requirements: ['Return sensor keys in alphabetical insertion order.', 'Round averages and maximum_pm25 to two decimals.', 'Empty input returns an empty dictionary.'],
      hint: 'Group the result of active_readings, then aggregate each sensor list.', maxLines: 26, runtimeBudgetMs: 24,
      concepts: concepts(['Dictionary grouping', 'setdefault\\s*\\(', '\\{'], ['Iteration', 'for\\s+'], ['Aggregation', 'sum\\s*\\(', 'max\\s*\\('], ['Helper reuse', 'active_readings\\s*\\(']),
      tests: READING_SETS.map((records) => test([records], sensorStatistics(records)))
    },
    {
      title: 'Detect Alert Streaks', entry: 'longest_alert_streak', entryType: 'function', course: 'Computer Programming 2+',
      prompt: 'Implement longest_alert_streak(records, threshold=35.4). For each sensor, return its longest run of consecutive cleaned readings strictly above the threshold.',
      requirements: ['Use each sensor’s timestamp order.', 'A reading at the threshold resets the run.', 'Include cleaned sensors with a longest streak of 0.'],
      hint: 'Group cleaned readings, then keep current and best counters for each sensor.', maxLines: 24, runtimeBudgetMs: 24,
      concepts: concepts(['Default parameter', 'threshold\\s*='], ['Stateful iteration', 'for\\s+', 'run'], ['Dictionary grouping', 'setdefault\\s*\\(', '\\{'], ['Helper reuse', 'active_readings\\s*\\(']),
      tests: READING_SETS.map((records) => test([records], longestAlertStreak(records)))
    },
    {
      title: 'Create a SensorNetwork Class', entry: 'SensorNetwork', entryType: 'class', course: 'Computer Programming 2+',
      classCheck: { addMethod: 'add_reading', outputs: { readings: 'cleaned_readings', sensors: 'sensor_report' } },
      prompt: 'Complete SensorNetwork. Store records, add readings, return cleaned readings, and produce sensor statistics through methods.',
      requirements: ['Keep state on self.records.', 'add_reading appends one record.', 'Reuse active_readings and sensor_statistics in report methods.'],
      hint: 'Make the class a thin stateful wrapper around the functions you already tested.', maxLines: 18, runtimeBudgetMs: 24,
      concepts: concepts(['Class definition', '^class\\s+SensorNetwork'], ['Constructor', 'def\\s+__init__'], ['Instance state', 'self\\.records'], ['Methods', 'def\\s+add_reading', 'def\\s+cleaned_readings', 'def\\s+sensor_report'], ['Helper reuse', 'active_readings\\s*\\(', 'sensor_statistics\\s*\\(']),
      tests: READING_SETS.map((records) => test([records], { readings: activeReadings(records), sensors: sensorStatistics(records) }))
    },
    {
      title: 'Assemble the Environment Report', entry: 'build_environment_report', entryType: 'function', course: 'Computer Programming 2+',
      prompt: 'Implement build_environment_report(records). Combine the full project into one network-level environmental report.',
      requirements: ['Return reading_count, readings, sensors, alerts, overall_average_pm25, and highest_risk_sensor.', 'highest_risk_sensor has the greatest maximum_pm25; alphabetical sensor ID resolves ties.', 'Empty input uses 0 for the average and None for highest risk.'],
      hint: 'Compose existing helpers or SensorNetwork; only the overall average and risk selection are new.', maxLines: 22, runtimeBudgetMs: 30,
      concepts: concepts(['Composition', 'SensorNetwork\\s*\\(', 'active_readings\\s*\\('], ['Statistics reuse', 'sensor_statistics\\s*\\(', 'sensor_report\\s*\\('], ['Alert reuse', 'longest_alert_streak\\s*\\('], ['Empty handling', 'if\\s+', 'None']),
      tests: READING_SETS.map((records) => test([records], environmentReport(records)))
    }
  ];

  tasks.forEach((task, index) => { task.id = `python-sensor-task-${index + 1}`; task.number = index + 1; });
  const starter = `from datetime import datetime

def normalize_sensor_id(sensor_id):
    # Task 1
    pass

def validate_reading(record):
    # Task 2
    pass

def celsius_to_fahrenheit(temperature_c):
    # Task 3
    pass

def air_quality_band(pm25):
    # Task 4
    pass

def normalize_reading(record):
    # Task 5
    pass

def active_readings(records):
    # Task 6
    pass

def sensor_statistics(records):
    # Task 7
    pass

def longest_alert_streak(records, threshold=35.4):
    # Task 8
    pass

class SensorNetwork:
    # Task 9
    pass

def build_environment_report(records):
    # Task 10
    pass
`;

  return {
    id: 'python-sensor-analysis', title: 'Environmental Sensor Analysis System', language: 'Python',
    description: 'Build a cumulative environmental-data pipeline while applying Computer Programming 1, 2, and 2+ concepts.',
    tasks, starter
  };
}));
