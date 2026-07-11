/* ============================================
   Weather Dashboard — Frontend JavaScript
   Connects to: https://web-production-071ce.up.railway.app/
   ============================================ */

const API_BASE = 'https://web-production-071ce.up.railway.app';

/* ── Auth Utilities ── */
const Auth = {
    getToken()   { return localStorage.getItem('weather_token'); },
    setToken(t)  { localStorage.setItem('weather_token', t); },
    clear()      { localStorage.removeItem('weather_token'); },
    isLoggedIn() { return !!this.getToken(); }
};

/* ── API Helper ── */
async function api(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = { 'Content-Type': 'application/json', ...options.headers };

    if (Auth.isLoggedIn()) {
        headers['Authorization'] = `Bearer ${Auth.getToken()}`;
    }

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
        Auth.clear();
        showSection('login');
        throw new Error('Session expired. Please log in again.');
    }
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
    }

    // Some endpoints return 204 No Content
    if (res.status === 204) return null;
    return res.json();
}

/* ── UI Helpers ── */
function showSection(id) {
    document.querySelectorAll('main > section').forEach(sec => {
        sec.style.display = sec.id === id ? 'block' : 'none';
    });
}

function showMessage(text, type = 'info') {
    let box = document.getElementById('toast-msg');
    if (!box) {
        box = document.createElement('div');
        box.id = 'toast-msg';
        box.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 1000;
            padding: 12px 20px; border-radius: 12px; font-size: 14px;
            font-weight: 500; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: opacity 0.3s;
        `;
        document.body.appendChild(box);
    }
    const colors = {
        success: 'background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0;',
        error:   'background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA;',
        info:    'background: #EFF6FF; color: #1E40AF; border: 1px solid #BFDBFE;'
    };
    box.style.cssText += colors[type] || colors.info;
    box.textContent = text;
    box.style.opacity = '1';
    setTimeout(() => { box.style.opacity = '0'; }, 3000);
}

/* ── Render: Dashboard Stats ── */
function renderStats(data) {
    const dl = document.querySelector('#dashboard dl');
    if (!dl) return;
    dl.innerHTML = `
        <dt>Total Locations</dt><dd>${data.total_locations ?? '-'}</dd>
        <dt>Weather Records</dt><dd>${data.total_weather_records ?? '-'}</dd>
        <dt>Forecast Records</dt><dd>${data.forecast_records ?? '-'}</dd>
        <dt>Average Temperature</dt><dd>${data.average_temperature ?? '-'}°C</dd>
        <dt>Your Favorites</dt><dd>${data.user_favorites ?? '-'}</dd>
    `;
}

/* ── Render: Alerts ── */
function renderAlerts(data) {
    const container = document.getElementById('alerts');
    if (!container || !data.alerts) return;

    // Remove old alert articles (keep the h2)
    container.querySelectorAll('article').forEach(a => a.remove());

    data.alerts.forEach(alert => {
        const article = document.createElement('article');
        article.innerHTML = `
            <header>
                <h3>${alert.type === 'extreme_heat' ? '🔥' : '💨'} ${alert.type === 'extreme_heat' ? 'Extreme Heat Warning' : 'Extreme Wind Warning'}</h3>
                <p>Severity: <strong>${alert.severity}</strong></p>
            </header>
            <p><strong>Location:</strong> ${alert.location}</p>
            <p><strong>Message:</strong> ${alert.message}</p>
            <p><strong>Recorded:</strong> <time datetime="${alert.recorded_at}">${new Date(alert.recorded_at).toLocaleString()}</time></p>
        `;
        container.appendChild(article);
    });
}

/* ── Render: Current Weather Cards ── */
function renderCurrentWeather(locations) {
    const container = document.getElementById('current-weather');
    if (!container) return;

    // Remove old articles (keep h2)
    container.querySelectorAll('article').forEach(a => a.remove());

    locations.forEach(loc => {
        const article = document.createElement('article');
        article.setAttribute('aria-label', `Current weather for ${loc.city}`);
        article.innerHTML = `
            <header>
                <h3>${loc.city}, ${loc.country}</h3>
                <p><time datetime="${loc.weather?.recorded_at || new Date().toISOString()}">${loc.weather ? new Date(loc.weather.recorded_at).toLocaleString() : 'Now'}</time></p>
            </header>
            <figure>
                <figcaption>Current Conditions</figcaption>
                <dl>
                    <dt>Temperature</dt><dd>${loc.weather?.temperature ?? '-'}°C</dd>
                    <dt>Feels Like</dt><dd>${loc.weather?.feels_like ?? '-'}°C</dd>
                    <dt>Condition</dt><dd>${loc.weather?.condition ?? '-'}</dd>
                    <dt>Description</dt><dd>${loc.weather?.description ?? '-'}</dd>
                    <dt>Humidity</dt><dd>${loc.weather?.humidity ?? '-'}%</dd>
                    <dt>Pressure</dt><dd>${loc.weather?.pressure ?? '-'} hPa</dd>
                    <dt>Wind Speed</dt><dd>${loc.weather?.wind_speed ?? '-'} km/h</dd>
                    <dt>Wind Direction</dt><dd>${loc.weather?.wind_direction ?? '-'}</dd>
                    <dt>Visibility</dt><dd>${loc.weather?.visibility ?? '-'} km</dd>
                    <dt>UV Index</dt><dd>${loc.weather?.uv_index ?? '-'}</dd>
                    <dt>Precipitation</dt><dd>${loc.weather?.precipitation ?? '-'} mm</dd>
                </dl>
            </figure>
            <footer>
                <button class="btn-fav" data-location-id="${loc.id}">Add to Favorites</button>
            </footer>
        `;
        container.appendChild(article);
    });

    // Attach favorite listeners
    container.querySelectorAll('.btn-fav').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.locationId;
            try {
                await api('/favorites', {
                    method: 'POST',
                    body: JSON.stringify({ location_id: parseInt(id) })
                });
                showMessage('Added to favorites!', 'success');
                loadFavorites();
            } catch (e) { showMessage(e.message, 'error'); }
        });
    });
}

/* ── Render: Forecast Table ── */
function renderForecast(locationId, data) {
    const container = document.getElementById('forecast');
    if (!container || !data.forecast) return;

    const article = container.querySelector('article') || document.createElement('article');
    article.innerHTML = `
        <h3>${data.location?.city || 'Location'}, ${data.location?.country || ''} — Forecast</h3>
        <table>
            <caption>Upcoming weather conditions</caption>
            <thead><tr>
                <th scope="col">Date</th>
                <th scope="col">Condition</th>
                <th scope="col">Temp</th>
                <th scope="col">Humidity</th>
                <th scope="col">Wind</th>
                <th scope="col">Precipitation</th>
            </tr></thead>
            <tbody>
                ${data.forecast.map(day => `
                    <tr>
                        <td><time datetime="${day.recorded_at}">${new Date(day.recorded_at).toLocaleDateString()}</time></td>
                        <td>${day.condition}</td>
                        <td>${day.temperature}°C</td>
                        <td>${day.humidity}%</td>
                        <td>${day.wind_speed} km/h ${day.wind_direction || ''}</td>
                        <td>${day.precipitation} mm</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    if (!container.contains(article)) container.appendChild(article);
}

/* ── Render: Locations Table ── */
function renderLocations(locations) {
    const tbody = document.querySelector('#locations tbody');
    if (!tbody) return;
    tbody.innerHTML = locations.map(loc => `
        <tr>
            <td>${loc.city}</td>
            <td>${loc.country}</td>
            <td>${loc.latitude}</td>
            <td>${loc.longitude}</td>
            <td>${loc.timezone}</td>
            <td>
                <a href="#" class="link-summary" data-id="${loc.id}">View Weather</a>
                <button class="btn-fav-inline" data-location-id="${loc.id}">Favorite</button>
            </td>
        </tr>
    `).join('');

    // View weather links
    tbody.querySelectorAll('.link-summary').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            loadWeatherSummary(link.dataset.id);
        });
    });

    // Favorite buttons
    tbody.querySelectorAll('.btn-fav-inline').forEach(btn => {
        btn.addEventListener('click', async () => {
            try {
                await api('/favorites', {
                    method: 'POST',
                    body: JSON.stringify({ location_id: parseInt(btn.dataset.locationId) })
                });
                showMessage('Added to favorites!', 'success');
                loadFavorites();
            } catch (e) { showMessage(e.message, 'error'); }
        });
    });
}

/* ── Render: Favorites ── */
function renderFavorites(favorites) {
    const container = document.getElementById('favorites');
    if (!container) return;

    // Remove old articles (keep h2)
    container.querySelectorAll('article').forEach(a => a.remove());

    if (!favorites.length) {
        const empty = document.createElement('article');
        empty.innerHTML = '<p>No favorites yet. Browse locations and add some!</p>';
        container.appendChild(empty);
        return;
    }

    favorites.forEach(fav => {
        const loc = fav.location;
        const article = document.createElement('article');
        article.setAttribute('aria-label', `Favorite location ${loc.city}`);
        article.innerHTML = `
            <h3>${loc.city}, ${loc.country}</h3>
            <p>Added on <time datetime="${fav.added_at}">${new Date(fav.added_at).toLocaleDateString()}</time></p>
            <a href="#" class="link-summary" data-id="${loc.id}">View Details</a>
            <button class="btn-remove-fav" data-location-id="${loc.id}">Remove from Favorites</button>
        `;
        container.appendChild(article);
    });

    // Remove listeners
    container.querySelectorAll('.btn-remove-fav').forEach(btn => {
        btn.addEventListener('click', async () => {
            try {
                await api(`/favorites/${btn.dataset.locationId}`, { method: 'DELETE' });
                showMessage('Removed from favorites', 'success');
                loadFavorites();
            } catch (e) { showMessage(e.message, 'error'); }
        });
    });

    // View links
    container.querySelectorAll('.link-summary').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            loadWeatherSummary(link.dataset.id);
        });
    });
}

/* ── Render: Weather Records ── */
function renderWeatherRecords(records) {
    const tbody = document.querySelector('#weather-details tbody');
    if (!tbody) return;
    tbody.innerHTML = records.map(r => `
        <tr>
            <td><time datetime="${r.recorded_at}">${new Date(r.recorded_at).toLocaleString()}</time></td>
            <td>${r.location?.city || 'Unknown'}</td>
            <td>${r.temperature}°C</td>
            <td>${r.condition}</td>
            <td>${r.humidity}%</td>
            <td>${r.pressure} hPa</td>
            <td>${r.wind_speed} km/h ${r.wind_direction || ''}</td>
            <td>${r.is_forecast ? 'Forecast' : 'Current'}</td>
        </tr>
    `).join('');
}

/* ── Render: User Profile ── */
function renderProfile(user) {
    const dl = document.querySelector('#settings dl');
    if (!dl) return;
    dl.innerHTML = `
        <dt>Username</dt><dd>${user.username}</dd>
        <dt>Email</dt><dd>${user.email}</dd>
        <dt>Full Name</dt><dd>${user.full_name || '-'}</dd>
        <dt>Account Status</dt><dd>${user.is_active ? 'Active' : 'Inactive'}</dd>
        <dt>Member Since</dt><dd><time datetime="${user.created_at}">${new Date(user.created_at).toLocaleDateString()}</time></dd>
    `;
}

/* ── Data Loaders ── */
async function loadDashboard() {
    try {
        const stats = await api('/dashboard/stats');
        renderStats(stats);
    } catch (e) { console.error('Stats:', e); }

    try {
        const alerts = await api('/dashboard/alerts');
        renderAlerts(alerts);
    } catch (e) { console.error('Alerts:', e); }
}

async function loadLocations() {
    try {
        const locations = await api('/locations');
        renderLocations(locations);
    } catch (e) { console.error('Locations:', e); }
}

async function loadCurrentWeather() {
    try {
        const locations = await api('/locations');
        // Fetch current weather for each location
        const enriched = await Promise.all(
            locations.map(async loc => {
                try {
                    const weather = await api(`/weather/current/${loc.id}`);
                    return { ...loc, weather };
                } catch {
                    return loc;
                }
            })
        );
        renderCurrentWeather(enriched);
    } catch (e) { console.error('Current weather:', e); }
}

async function loadForecast(locationId = 3) {
    try {
        const summary = await api(`/weather/summary/${locationId}`);
        renderForecast(locationId, summary);
    } catch (e) { console.error('Forecast:', e); }
}

async function loadFavorites() {
    try {
        const favorites = await api('/favorites');
        renderFavorites(favorites);
    } catch (e) { console.error('Favorites:', e); }
}

async function loadWeatherRecords(params = '') {
    try {
        const records = await api(`/weather${params}`);
        renderWeatherRecords(records);
    } catch (e) { console.error('Records:', e); }
}

async function loadProfile() {
    try {
        const user = await api('/auth/me');
        renderProfile(user);
    } catch (e) { console.error('Profile:', e); }
}

async function loadWeatherSummary(locationId) {
    try {
        const summary = await api(`/weather/summary/${locationId}`);
        // Switch to current weather section and show this location
        renderCurrentWeather([{
            ...summary.location,
            weather: summary.current
        }]);
        renderForecast(locationId, summary);
        showSection('current-weather');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { showMessage(e.message, 'error'); }
}

/* ── Initialize App ── */
function initApp() {
    // Show all sections by default (the CSS handles layout)
    // If logged in, load data
    if (Auth.isLoggedIn()) {
        loadDashboard();
        loadLocations();
        loadCurrentWeather();
        loadForecast();
        loadFavorites();
        loadWeatherRecords();
        loadProfile();
    }
}

/* ── Event Listeners ── */
document.addEventListener('DOMContentLoaded', () => {

    /* ── Login Form ── */
    const loginForm = document.querySelector('#login form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = loginForm.querySelector('#username').value;
            const password = loginForm.querySelector('#password').value;

            try {
                const data = await api('/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
                });
                Auth.setToken(data.access_token);
                showMessage('Welcome back!', 'success');
                initApp();
            } catch (err) {
                showMessage(err.message, 'error');
            }
        });
    }

    /* ── Register Form ── */
    const regForm = document.querySelector('#register form');
    if (regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                username: regForm.querySelector('#reg-username').value,
                email: regForm.querySelector('#reg-email').value,
                full_name: regForm.querySelector('#reg-fullname').value,
                password: regForm.querySelector('#reg-password').value
            };

            try {
                await api('/auth/register', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                showMessage('Account created! Please log in.', 'success');
                showSection('login');
            } catch (err) {
                showMessage(err.message, 'error');
            }
        });
    }

    /* ── Weather Filter Form ── */
    const filterForm = document.querySelector('#weather-details form');
    if (filterForm) {
        filterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const fd = new FormData(filterForm);
            const params = new URLSearchParams();
            if (fd.get('location_id')) params.append('location_id', fd.get('location_id'));
            if (fd.get('condition')) params.append('condition', fd.get('condition'));
            if (fd.get('is_forecast')) params.append('is_forecast', fd.get('is_forecast'));
            loadWeatherRecords(params.toString() ? '?' + params.toString() : '');
        });
    }

    /* ── Search Form ── */
    const searchForm = document.querySelector('header search form');
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const q = searchForm.querySelector('input').value.toLowerCase();
            // Simple client-side filter on locations
            const rows = document.querySelectorAll('#locations tbody tr');
            rows.forEach(row => {
                const city = row.cells[0].textContent.toLowerCase();
                row.style.display = city.includes(q) ? '' : 'none';
            });
            showSection('locations');
        });
    }

    /* ── Intercept static favorite forms in HTML ── */
    document.querySelectorAll('form[action="/favorites"]').forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = form.querySelector('input[name="location_id"]')?.value;
            if (!id) return;
            try {
                await api('/favorites', {
                    method: 'POST',
                    body: JSON.stringify({ location_id: parseInt(id) })
                });
                showMessage('Added to favorites!', 'success');
                loadFavorites();
            } catch (err) { showMessage(err.message, 'error'); }
        });
    });

    /* ── Intercept remove favorite forms ── */
    document.querySelectorAll('form[action^="/favorites/"]').forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const action = form.getAttribute('action');
            const id = action.split('/').pop();
            try {
                await api(`/favorites/${id}`, { method: 'DELETE' });
                showMessage('Removed from favorites', 'success');
                loadFavorites();
            } catch (err) { showMessage(err.message, 'error'); }
        });
    });

    /* ── Navigation links (smooth scroll to sections) ── */
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            const target = document.querySelector(link.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    /* ── Seed button (if present) ── */
    const seedBtn = document.querySelector('button[data-action="seed"]');
    if (seedBtn) {
        seedBtn.addEventListener('click', async () => {
            try {
                await api('/seed', { method: 'POST' });
                showMessage('Database seeded!', 'success');
                initApp();
            } catch (err) { showMessage(err.message, 'error'); }
        });
    }

    /* ── Logout helper (add a logout button dynamically if needed) ── */
    const header = document.querySelector('body > header');
    if (header && Auth.isLoggedIn()) {
        const logoutBtn = document.createElement('button');
        logoutBtn.textContent = 'Logout';
        logoutBtn.style.cssText = 'margin-left:auto;background:#EF4444;';
        logoutBtn.addEventListener('click', () => {
            Auth.clear();
            showMessage('Logged out', 'info');
            location.reload();
        });
        header.appendChild(logoutBtn);
    }

    // Boot
    initApp();
});