// MODEL USED FOR PREDICTION
// Example: Linear Regression (update this if you use another model)
const MODEL_USED = "Linear Regression";

// Get unique manufacturers and models from CSV
const parseCSVData = (csvData) => {
    const manufacturers = new Set();
    const modelsByManufacturer = {};

    // Skip header row and split into lines
    const lines = csvData.split('\n').slice(1);

    lines.forEach(line => {
        const [model, year, price, transmission, mileage, fuelType, tax, mpg, engineSize, manufacturer] = line.split(',');
        if (manufacturer) {
            const cleanManufacturer = manufacturer.trim().toLowerCase();
            manufacturers.add(cleanManufacturer);

            if (!modelsByManufacturer[cleanManufacturer]) {
                modelsByManufacturer[cleanManufacturer] = new Set();
            }
            modelsByManufacturer[cleanManufacturer].add(model.trim());
        }
    });

    return {
        manufacturers: Array.from(manufacturers),
        modelsByManufacturer: Object.fromEntries(
            Object.entries(modelsByManufacturer).map(([mfr, models]) => [mfr, Array.from(models)])
        )
    };
};

// Update manufacturer select options with CSV data
const updateManufacturerSelect = (selectElem, manufacturers) => {
    selectElem.innerHTML = '<option value="">Select Manufacturer</option>';
    manufacturers.sort().forEach(manufacturer => {
        const option = document.createElement('option');
        option.value = manufacturer;
        option.textContent = manufacturer.charAt(0).toUpperCase() + manufacturer.slice(1);
        selectElem.appendChild(option);
    });
};

// When page loads, read and parse CSV data
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize sample data for charts
    const modelPerformanceData = {
        labels: ['Linear Regression', 'Decision Tree', 'Random Forest', 'Gradient Boosting'],
        r2Scores: [0.85, 0.89, 0.92, 0.91]
    };

    const predictionData = {
        dates: [],
        usdPrices: [],
        nairaPrices: []
    };

    // Initialize charts first so they can be referenced later
    let usdPredictionChart, nairaPredictionChart;

    // Create Model Performance Chart
    const modelPerformanceChart = new Chart(
        document.getElementById('modelPerformanceChart'),
        {
            type: 'bar',
            data: {
                labels: modelPerformanceData.labels,
                datasets: [
                    {
                        label: 'R² Score',
                        data: modelPerformanceData.r2Scores,
                        backgroundColor: '#3498db',
                        borderColor: '#2980b9',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                animation: {
                    duration: 2000,
                    easing: 'easeInOutQuart'
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Model Performance Comparison'
                    }
                }
            }
        }
    );

    // Initialize prediction charts
    usdPredictionChart = new Chart(
        document.getElementById('usdPredictionChart'),
        {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Predicted Price (USD)',
                    data: [],
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                animation: {
                    duration: 2000,
                    easing: 'easeInOutQuart'
                }
            }
        }
    );

    nairaPredictionChart = new Chart(
        document.getElementById('nairaPredictionChart'),
        {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Predicted Price (₦)',
                    data: [],
                    borderColor: '#2ecc71',
                    backgroundColor: 'rgba(46, 204, 113, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                animation: {
                    duration: 2000,
                    easing: 'easeInOutQuart'
                }
            }
        }
    );

    let currentExchangeRate = 0;

    // Toaster utility
    function showToaster(message, type = 'info', timeout = 2500) {
        const toaster = document.getElementById('toaster');
        if (!toaster) return;
        toaster.textContent = message;
        toaster.classList.remove('hidden');
        toaster.classList.remove('bg-accent', 'bg-secondary', 'bg-primary');
        if (type === 'success') toaster.classList.add('bg-secondary');
        else if (type === 'error') toaster.classList.add('bg-accent');
        else toaster.classList.add('bg-primary');
        setTimeout(() => {
            toaster.classList.add('hidden');
        }, timeout);
    }

    const updateExchangeRate = async () => {
        try {
            // Using exchangerate-api.com free API (you'll need to sign up for an API key)
            const response = await fetch('https://v6.exchangerate-api.com/v6/f1f60dbb80f86ef0926d0b3e/pair/USD/NGN');
            const data = await response.json();
            currentExchangeRate = data.conversion_rate;
            
            document.getElementById('exchangeRate').textContent = 
                `1 USD = ₦${currentExchangeRate.toFixed(2)}`;
            document.getElementById('lastUpdated').textContent = 
                new Date().toLocaleString();

            showToaster('Exchange rate updated successfully.', 'success');
        } catch (error) {
            console.error('Failed to fetch exchange rate:', error);
            document.getElementById('exchangeRate').textContent = 'Error loading rate';
            showToaster('Failed to fetch exchange rate.', 'error');
        }
    };

    // Update exchange rate every hour
    updateExchangeRate();
    setInterval(updateExchangeRate, 3600000);

    let csvData, manufacturers, modelsByManufacturer, carRows;
    let trendChartInstanceUSD = null;
    let trendChartInstanceNaira = null;

    // Tab switching logic
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => {
                p.classList.remove('active');
                p.classList.add('hidden');
            });
            this.classList.add('active');
            const panel = document.getElementById(this.dataset.tab);
            panel.classList.add('active');
            panel.classList.remove('hidden');
        });
    });

    try {
        const response = await fetch('CarsData.csv');
        csvData = await response.text();
        ({manufacturers, modelsByManufacturer, carRows} = parseCSVData(csvData));

        // --- TREND TAB ---
        const trendManufacturerSelect = document.getElementById('trendManufacturer');
        const trendModelSelect = document.getElementById('trendModel');
        updateManufacturerSelect(trendManufacturerSelect, manufacturers);

        trendManufacturerSelect.addEventListener('change', () => {
            const manufacturer = trendManufacturerSelect.value;
            trendModelSelect.innerHTML = '<option value="">Select Model</option>';
            if (manufacturer) {
                modelsByManufacturer[manufacturer].sort().forEach(model => {
                    const option = document.createElement('option');
                    option.value = model;
                    option.textContent = model;
                    trendModelSelect.appendChild(option);
                });
                trendModelSelect.disabled = false;
            } else {
                trendModelSelect.disabled = true;
            }
            // Clear charts if manufacturer changes
            if (trendChartInstanceUSD) {
                trendChartInstanceUSD.destroy();
                trendChartInstanceUSD = null;
            }
            if (trendChartInstanceNaira) {
                trendChartInstanceNaira.destroy();
                trendChartInstanceNaira = null;
            }
        });

        trendModelSelect.addEventListener('change', () => {
            const manufacturer = trendManufacturerSelect.value;
            const model = trendModelSelect.value;
            if (manufacturer && model) {
                const trendData = carRows
                    .filter(row => row.Manufacturer === manufacturer && row.model === model)
                    .sort((a, b) => a.year - b.year);

                const years = [...new Set(trendData.map(row => row.year))].sort((a, b) => a - b);
                const avgPrices = years.map(year => {
                    const prices = trendData.filter(row => row.year === year).map(row => row.price);
                    return prices.length ? (prices.reduce((a, b) => a + b, 0) / prices.length) : null;
                });

                // Draw USD chart
                const ctxUSD = document.getElementById('trendChartUSD').getContext('2d');
                if (trendChartInstanceUSD) trendChartInstanceUSD.destroy();
                trendChartInstanceUSD = new Chart(ctxUSD, {
                    type: 'line',
                    data: {
                        labels: years,
                        datasets: [{
                            label: 'Average Price (USD)',
                            data: avgPrices,
                            borderColor: '#3498db',
                            backgroundColor: 'rgba(52,152,219,0.1)',
                            fill: true,
                            tension: 0.2
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { display: false },
                            title: { display: true, text: `Price Trend: ${manufacturer} ${model}` }
                        },
                        scales: {
                            y: { beginAtZero: false, title: { display: true, text: 'USD Price' } },
                            x: { title: { display: true, text: 'Year' } }
                        }
                    }
                });

                // Draw Naira chart
                const ctxNaira = document.getElementById('trendChartNaira').getContext('2d');
                if (trendChartInstanceNaira) trendChartInstanceNaira.destroy();
                const nairaPrices = avgPrices.map(p => p * currentExchangeRate);
                trendChartInstanceNaira = new Chart(ctxNaira, {
                    type: 'line',
                    data: {
                        labels: years,
                        datasets: [{
                            label: 'Average Price (₦)',
                            data: nairaPrices,
                            borderColor: '#2ecc71',
                            backgroundColor: 'rgba(46,204,113,0.1)',
                            fill: true,
                            tension: 0.2
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { display: false },
                            title: { display: true, text: `Price Trend: ${manufacturer} ${model}` }
                        },
                        scales: {
                            y: { beginAtZero: false, title: { display: true, text: 'Naira Price' } },
                            x: { title: { display: true, text: 'Year' } }
                        }
                    }
                });
            } else {
                if (trendChartInstanceUSD) {
                    trendChartInstanceUSD.destroy();
                    trendChartInstanceUSD = null;
                }
                if (trendChartInstanceNaira) {
                    trendChartInstanceNaira.destroy();
                    trendChartInstanceNaira = null;
                }
            }
        });

        // --- PREDICT TAB ---
        const manufacturerSelect = document.getElementById('carManufacturer');
        const modelSelect = document.getElementById('carModel');
        updateManufacturerSelect(manufacturerSelect, manufacturers);

        manufacturerSelect.addEventListener('change', () => {
            const manufacturer = manufacturerSelect.value;
            modelSelect.innerHTML = '<option value="">Select Model</option>';
            if (manufacturer) {
                modelsByManufacturer[manufacturer].sort().forEach(model => {
                    const option = document.createElement('option');
                    option.value = model;
                    option.textContent = model;
                    modelSelect.appendChild(option);
                });
                modelSelect.disabled = false;
            } else {
                modelSelect.disabled = true;
            }
        });

        // Initialize form handlers
        const yearInput = document.getElementById('predictionYear');
        const predictBtn = document.getElementById('predictBtn');

        predictBtn.addEventListener('click', async () => {
            const manufacturer = manufacturerSelect.value;
            const model = modelSelect.value;
            const year = yearInput.value;

            if (!manufacturer || !model || !year) {
                alert('Please select all fields');
                return;
            }

            try {
                predictBtn.classList.add('loading');
                
                // Simulate API call with sample data
                // In real application, this would be an actual API call to your backend
                const prediction = await predictPrice(manufacturer, model, year);
                
                // Update charts with new prediction
                updateCharts(prediction);
                
                // Update table
                updatePredictionTable(prediction);
            } catch (error) {
                console.error('Prediction failed:', error);
                alert('Failed to get prediction. Please try again.');
            } finally {
                predictBtn.classList.remove('loading');
            }
        });

        // Populate the predictions table
        const populateTable = () => {
            const tableBody = document.querySelector('#predictionsTable tbody');
            
            for (let i = 0; i < predictionData.dates.length; i++) {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${predictionData.dates[i]}</td>
                    <td>$${predictionData.usdPrices[i].toLocaleString()}</td>
                    <td>₦${predictionData.nairaPrices[i].toLocaleString()}</td>
                `;
                tableBody.appendChild(row);
            }
        };

        // Initialize the table when the page loads
        document.addEventListener('DOMContentLoaded', populateTable);

        async function predictPrice(manufacturer, model, year) {
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Sample prediction calculation
            // Replace this with actual API call to your ML model
            const basePrice = Math.random() * 50000 + 20000;
            const yearDiff = year - 2025;
            const predictedPrice = basePrice * (1 + yearDiff * 0.03);
            
            return {
                usdPrice: predictedPrice,
                nairaPrice: predictedPrice * currentExchangeRate,
                year: year
            };
        }

        function updateCharts(prediction) {
            // Update existing charts with new prediction data
            usdPredictionChart.data.labels = [prediction.year];
            usdPredictionChart.data.datasets[0].data = [prediction.usdPrice];
            usdPredictionChart.update();

            nairaPredictionChart.data.labels = [prediction.year];
            nairaPredictionChart.data.datasets[0].data = [prediction.nairaPrice];
            nairaPredictionChart.update();
        }

        function updatePredictionTable(prediction) {
            const tableBody = document.querySelector('#predictionsTable tbody');
            tableBody.innerHTML = ''; // Clear existing rows

            // Properly close <b> tags to avoid syntax error
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${prediction.year}</td>
                <td><b>$${prediction.usdPrice.toLocaleString(undefined, {maximumFractionDigits: 2})}</b></td>
                <td><b>₦${prediction.nairaPrice.toLocaleString(undefined, {maximumFractionDigits: 2})}</b></td>
            `;
            tableBody.appendChild(row);
        }

    } catch (error) {
        console.error('Error loading CSV data:', error);
        alert('Failed to load car data. Please refresh the page.');
    }

    // --- Utility functions ---
    function updateManufacturerSelect(selectElem, manufacturers) {
        selectElem.innerHTML = '<option value="">Select Manufacturer</option>';
        manufacturers.sort().forEach(manufacturer => {
            const option = document.createElement('option');
            option.value = manufacturer;
            option.textContent = manufacturer.charAt(0).toUpperCase() + manufacturer.slice(1);
            selectElem.appendChild(option);
        });
    }

    function parseCSVData(csv) {
        const lines = csv.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim());
        const carRows = [];
        const manufacturersSet = new Set();
        const modelsByManufacturer = {};

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            if (values.length !== headers.length) continue;
            const row = {};
            headers.forEach((h, idx) => row[h] = values[idx]);
            row.year = parseInt(row.year, 10);
            row.price = parseFloat(row.price);
            manufacturersSet.add(row.Manufacturer);
            if (!modelsByManufacturer[row.Manufacturer]) modelsByManufacturer[row.Manufacturer] = new Set();
            modelsByManufacturer[row.Manufacturer].add(row.model);
            carRows.push(row);
        }
        // Convert model sets to arrays
        Object.keys(modelsByManufacturer).forEach(m => {
            modelsByManufacturer[m] = Array.from(modelsByManufacturer[m]);
        });
        return {
            manufacturers: Array.from(manufacturersSet),
            modelsByManufacturer,
            carRows
        };
    }

    let exchangeRate = 1; // Default, will be updated from API

    // Fetch exchange rate and update UI
    async function fetchExchangeRate() {
        try {
            // Example: USD to NGN
            const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
            const data = await res.json();
            exchangeRate = data.rates.NGN;
            document.getElementById('exchangeRate').textContent = exchangeRate.toFixed(2) + ' NGN/USD';
            document.getElementById('lastUpdated').textContent = new Date().toLocaleString();
        } catch (e) {
            document.getElementById('exchangeRate').textContent = 'Unavailable';
            document.getElementById('lastUpdated').textContent = '-';
        }
    }

    // Trend chart instance
    let trendChart;

    // Show model used in the UI
    function showModelUsed() {
        const el = document.getElementById('modelUsed');
        if (el) el.textContent = `Prediction Model: ${MODEL_USED}`;
    }

    // Show trend chart year range in the UI
    function showTrendYearRange(years) {
        const el = document.getElementById('trendYearRange');
        if (el && years.length) {
            el.textContent = `Trend from ${Math.min(...years)} to ${Math.max(...years)}`;
        }
    }

    // Update trend chart with both USD and Naira
    function updateTrendChart(years, usdPrices) {
        showTrendYearRange(years);
        const nairaPrices = usdPrices.map(p => p * exchangeRate);
        const ctx = document.getElementById('trendChart').getContext('2d');
        if (trendChart) trendChart.destroy();
        trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years,
                datasets: [
                    {
                        label: 'USD Price',
                        data: usdPrices,
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52,152,219,0.1)',
                        fill: false,
                        yAxisID: 'y',
                    },
                    {
                        label: 'Naira Price',
                        data: nairaPrices,
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231,76,60,0.1)',
                        fill: false,
                        yAxisID: 'y1',
                    }
                ]
            },
            options: {
                responsive: true,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: true }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: { display: true, text: 'USD' }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        title: { display: true, text: 'Naira' }
                    }
                }
            }
        });
    }

    // Example: When user selects manufacturer/model for trend
    async function onTrendSelection(manufacturer, model) {
        // ...fetch and filter data for selected manufacturer/model...
        // Suppose you get arrays: years, usdPrices
        // updateTrendChart(years, usdPrices);
    }

    // On page load
    document.addEventListener('DOMContentLoaded', () => {
        showModelUsed();
        fetchExchangeRate();
    });
});
