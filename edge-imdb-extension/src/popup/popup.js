document.addEventListener('DOMContentLoaded', function() {
    // Tab switching logic
    const tabMain = document.getElementById('tab-main');
    const tabDomains = document.getElementById('tab-domains');
    const mainContent = document.getElementById('main-content');
    const domainsContent = document.getElementById('domains-content');
    // ...existing code...

    // Hide Next button when switching to Domains tab
    tabDomains.addEventListener('click', function() {
        nextButton.style.display = 'none';
    });
    tabMain.addEventListener('click', function() {
        // Restore Next button if it should be visible
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            const currentTab = tabs[0];
            const base = getDefaultDomain();
            const urlPattern = new RegExp(`${base.replace('.', '\.')}/embed/tv/(.+)/(\d+)-(\d+)`);
            if (urlPattern.test(currentTab.url)) {
                nextButton.style.display = 'block';
            } else {
                nextButton.style.display = 'none';
            }
        });
    });

    tabMain.addEventListener('click', function() {
        tabMain.classList.add('active');
        tabDomains.classList.remove('active');
        mainContent.classList.add('active');
        domainsContent.classList.remove('active');
    });
    tabDomains.addEventListener('click', function() {
        tabDomains.classList.add('active');
        tabMain.classList.remove('active');
        domainsContent.classList.add('active');
        mainContent.classList.remove('active');
        showDomainsTab();
    });

    // Domain list caching and retrieval
    const DOMAIN_CACHE_KEY = 'vidsrc_domains_cache';
    const DOMAIN_CACHE_DATE_KEY = 'vidsrc_domains_cache_date';
    const DOMAIN_DEFAULT_KEY = 'vidsrc_default_domain';
    const DOMAIN_LIST_URL = 'https://vidsrc.xyz'; // Original landing URL (will redirect if needed)

    const manualDomainInput = document.getElementById('manual-domain-input');
    const manualDomainSave = document.getElementById('manual-domain-save');
    const manualDomainMessage = document.getElementById('manual-domain-message');
    let lastRedirectAlertDomain = null;

    function getCachedDomains() {
        const cache = localStorage.getItem(DOMAIN_CACHE_KEY);
        const date = localStorage.getItem(DOMAIN_CACHE_DATE_KEY);
        if (cache && date) {
            const cacheDate = new Date(date);
            const now = new Date();
            const diffDays = (now - cacheDate) / (1000 * 60 * 60 * 24);
            if (diffDays < 30) {
                try {
                    return JSON.parse(cache);
                } catch (e) { return null; }
            }
        }
        return null;
    }

    function setCachedDomains(domains) {
        localStorage.setItem(DOMAIN_CACHE_KEY, JSON.stringify(domains));
        localStorage.setItem(DOMAIN_CACHE_DATE_KEY, new Date().toISOString());
    }

    function getDefaultDomain() {
        return localStorage.getItem(DOMAIN_DEFAULT_KEY) || 'https://vidsrc.pm';
    }
    function setDefaultDomain(domain) {
        localStorage.setItem(DOMAIN_DEFAULT_KEY, domain);
    }

    function extractVidsrcDomain(urlValue) {
        if (!urlValue) {
            return null;
        }
        try {
            const parsed = new URL(urlValue);
            const host = parsed.hostname.toLowerCase();
            if (/(?:vidsrc[a-z0-9-]*|vsrc[a-z0-9-]*)\.[a-z]{2,}$/i.test(host)) {
                return `https://${host}`;
            }
        } catch (e) {
            return null;
        }
        return null;
    }

    function normalizeDomainInput(value) {
        if (!value) {
            return null;
        }
        let trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        if (!/^https?:\/\//i.test(trimmed)) {
            trimmed = `https://${trimmed}`;
        }
        return extractVidsrcDomain(trimmed);
    }

    function updateManualDomainMessage(message, isError = true) {
        if (!manualDomainMessage) {
            return;
        }
        manualDomainMessage.textContent = message || '';
        if (message) {
            if (isError) {
                manualDomainMessage.classList.remove('success');
            } else {
                manualDomainMessage.classList.add('success');
            }
        } else {
            manualDomainMessage.classList.remove('success');
        }
    }

    function handleRedirectDomain(domain) {
        if (!domain) {
            return;
        }
        if (domain === lastRedirectAlertDomain) {
            return;
        }
        lastRedirectAlertDomain = domain;
        setDefaultDomain(domain);
        vidsrcBaseURL = domain;
        updateManualDomainMessage(`Detected redirect to ${domain}. Default domain updated.`, false);
        try {
            alert(`Vidsrc domain redirected to ${domain}. Default domain updated.`);
        } catch (e) {
            console.warn('Unable to show alert for redirect domain', e);
        }
    }

    async function detectRedirectDomain() {
        try {
            const resp = await fetch(DOMAIN_LIST_URL, { mode: 'no-cors', redirect: 'follow' });
            if (resp && resp.url) {
                const detected = extractVidsrcDomain(resp.url);
                if (detected) {
                    return detected;
                }
            }
        } catch (e) {
            console.warn('Redirect detection failed', e);
        }
        return null;
    }

    async function fetchDomainsFromPage() {
        const result = { domains: [], redirectedDomain: null };
        try {
            const resp = await fetch(DOMAIN_LIST_URL, { redirect: 'follow' });
            if (!resp.ok) {
                throw new Error(`Request failed with status ${resp.status}`);
            }

            const text = await resp.text();
            const domainRegex = /(?:https?:\/\/)?((?:[a-z0-9-]+\.)*(?:vidsrc[a-z0-9-]*|vsrc[a-z0-9-]*)\.[a-z]{2,})/gi;
            const domainSet = new Set();

            let match;
            while ((match = domainRegex.exec(text)) !== null) {
                const domain = match[1].toLowerCase();
                domainSet.add(`https://${domain}`);
            }

            // Include the final response host if it matches
            try {
                const finalHost = new URL(resp.url || DOMAIN_LIST_URL).hostname;
                if (finalHost) {
                    const hostMatch = finalHost.match(/(?:vidsrc[a-z0-9-]*|vsrc[a-z0-9-]*)\.[a-z]{2,}$/i);
                    if (hostMatch) {
                        domainSet.add(`https://${finalHost.toLowerCase()}`);
                    }
                }
            } catch (e) {
                // Ignore URL parsing errors
            }

            result.domains = Array.from(domainSet);
            return result;
        } catch (e) {
            console.warn('Failed to fetch domain list via CORS', e);
            const redirected = await detectRedirectDomain();
            if (redirected) {
                result.domains = [redirected];
                result.redirectedDomain = redirected;
                return result;
            }
            throw e;
        }
    }

    async function getDomains() {
        let domains = getCachedDomains();
        if (!domains) {
            const fetchResult = await fetchDomainsFromPage();
            domains = fetchResult.domains;
            if (domains && domains.length > 0) {
                setCachedDomains(domains);
                const storedDefault = localStorage.getItem(DOMAIN_DEFAULT_KEY);
                const currentDefault = storedDefault || 'https://vidsrc.pm';
                if (!domains.includes(currentDefault)) {
                    setDefaultDomain(domains[0]);
                }
            }
            if (fetchResult.redirectedDomain) {
                handleRedirectDomain(fetchResult.redirectedDomain);
            }
        }
        return domains;
    }

    async function showDomainsTab() {
        const domainsList = document.getElementById('domains-list');
        const defaultLabel = document.getElementById('default-domain-label');
        domainsList.innerHTML = '<span>Loading...</span>';
        let domains = [];
        let error = null;
        try {
            domains = await getDomains();
        } catch (e) {
            error = e;
        }
        const defaultDomain = getDefaultDomain();
        domainsList.innerHTML = '';
        if (manualDomainInput && defaultDomain) {
            manualDomainInput.placeholder = defaultDomain;
            manualDomainInput.value = defaultDomain;
        }
        if (error) {
            domainsList.innerHTML = `<span style='color:red;'>Error loading domains: ${error}</span>`;
        } else if (!domains || domains.length === 0) {
            domainsList.innerHTML = `<span>No domains found. Please check your connection or try again later.</span>`;
        } else {
            domains.forEach(domain => {
                const item = document.createElement('div');
                item.className = 'domain-item';
                item.innerHTML = `<span>${domain}</span>`;
                const btn = document.createElement('button');
                btn.className = 'domain-set-default' + (domain === defaultDomain ? ' active' : '');
                btn.textContent = domain === defaultDomain ? 'Default' : 'Set Default';
                btn.disabled = domain === defaultDomain;
                btn.addEventListener('click', function() {
                    setDefaultDomain(domain);
                    vidsrcBaseURL = domain;
                    updateManualDomainMessage('Default domain updated.', false);
                    showDomainsTab();
                });
                item.appendChild(btn);
                domainsList.appendChild(item);
            });
        }
        defaultLabel.textContent = `Current default domain: ${defaultDomain}`;
    }
    console.log('Popup script loaded'); // Debugging line to check script load
    // Helper to extract Vidsrc domain from a URL
    function getVidsrcBaseURL(url) {
        const match = url.match(/https:\/\/(?:[a-z0-9-]+\.)*(?:vidsrc[a-z0-9-]*|vsrc[a-z0-9-]*)\.[a-z]{2,}/i);
        return match ? match[0] : getDefaultDomain();
    }

    let vidsrcBaseURL = getDefaultDomain();
    let currentTabUrl = '';
    // Set vidsrcBaseURL from current tab at startup
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs && tabs[0]) {
            currentTabUrl = tabs[0].url;
            vidsrcBaseURL = getVidsrcBaseURL(currentTabUrl);
            // Show Next button if on a Vidsrc embed page
            const urlPattern = new RegExp(`${vidsrcBaseURL.replace('.', '\\.')}/embed/tv/(.+)/(\\d+)-(\\d+)`);
            if (urlPattern.test(currentTabUrl)) {
                nextButton.style.display = 'block';
            }
        }
    });
    const input = document.getElementById('query');
    const resultsContainer = document.getElementById('results');
    const searchButton = document.getElementById('search-button');

    searchButton.addEventListener('click', function(event) {
        event.preventDefault();
        const query = input.value;
        queryIMDbData(query);
    });
        // ...existing code...
    input.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            const query = input.value;
        // Helper to extract Vidsrc domain from a URL
        function getVidsrcBaseURL(url) {
            const match = url.match(/https:\/\/(?:[a-z0-9-]+\.)*(?:vidsrc[a-z0-9-]*|vsrc[a-z0-9-]*)\.[a-z]{2,}/i);
            return match ? match[0] : null;
        }

        // Set vidsrcBaseURL from current tab
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            const currentTab = tabs[0];
            vidsrcBaseURL = getVidsrcBaseURL(currentTab.url) || getDefaultDomain();
            // Show Next button if on a Vidsrc embed page
            const urlPattern = new RegExp(`${vidsrcBaseURL.replace('.', '\\.')}/embed/tv/(.+)/(\\d+)-(\\d+)`);
            if (urlPattern.test(currentTab.url)) {
                nextButton.style.display = 'block';
            }
        });
            queryIMDbData(query);
        }
    });

    if (manualDomainSave && manualDomainInput) {
        manualDomainSave.addEventListener('click', function() {
            const normalized = normalizeDomainInput(manualDomainInput.value);
            if (!normalized) {
                updateManualDomainMessage('Enter a valid Vidsrc domain URL.', true);
                return;
            }
            setDefaultDomain(normalized);
            vidsrcBaseURL = normalized;
            manualDomainInput.value = normalized;
            updateManualDomainMessage('Default domain updated.', false);
            showDomainsTab();
        });

        manualDomainInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                manualDomainSave.click();
            }
        });
    }

    function queryIMDbData(query) {
        chrome.runtime.sendMessage({ action: 'queryIMDb', query: query }, displayResults);
    }

    function displayResults(response) {
        console.log('Response:', response); // Debugging line
        resultsContainer.innerHTML = ''; // Clear the results container
        if (response && response.results) {
            response.results.forEach(item => {
                var resultItem = document.createElement('div');
                resultItem.className = 'result-item';
                resultItem.innerHTML = `<h3>${item.Title}</h3><p>${item.Year}</p>`;
                resultItem.addEventListener('click', function() {
                    fetchIMDbDetails(item.imdbID);
                });
                resultsContainer.appendChild(resultItem);
            });
        } else {
            resultsContainer.innerHTML = '<p>No results found.</p>';
        }
    }

    function fetchIMDbDetails(imdbID) {
        chrome.runtime.sendMessage({ action: 'queryIMDbDetails', imdbID: imdbID }, function(response) {
            displayDetails(response);
        });
    }

    function displayDetails(response) {
        resultsContainer.innerHTML = '';
        console.log('Details Response:', response); // Debugging line
        if (response && response.results) {
            const title = document.createElement('h2');
            if (response.results.Type === 'episode') {
                title.textContent = `${response.results.Title} (S${response.results.Season}-E${response.results.Episode})`;
            } else {
                title.textContent = response.results.Title;
            }
            resultsContainer.appendChild(title);

            const dates = document.createElement('p');
            dates.textContent = `${response.results.Released} - ${response.results.Year}`;
            resultsContainer.appendChild(dates);

            const actors = document.createElement('p');
            actors.textContent = `Actors: ${response.results.Actors}`;
            resultsContainer.appendChild(actors);

            const rating = document.createElement('p');
            rating.textContent = `IMDb Rating: ${response.results.imdbRating}`;
            resultsContainer.appendChild(rating);

            if (response.results.Type === 'episode') {
                const vidsrcButton = document.createElement('button');
                vidsrcButton.textContent = 'Vidsrc';
                vidsrcButton.addEventListener('click', function() {
                    const base = getDefaultDomain();
                    const seriesId = response.results.seriesID;
                    const seasonNumber = response.results.Season;
                    const episodeNumber = response.results.Episode;
                    const url = `${base}/embed/tv/${seriesId}/${seasonNumber}-${episodeNumber}`;
                    chrome.tabs.create({ url: url });
                });
                resultsContainer.appendChild(vidsrcButton);
            }

            if (response.results.Type === 'movie') {
                const vidsrcButton = document.createElement('button');
                vidsrcButton.textContent = 'Vidsrc';
                vidsrcButton.addEventListener('click', function() {
                    const base = getDefaultDomain();
                    const imdbID = response.results.imdbID;
                    const url = `${base}/embed/movie/${imdbID}`;
                    chrome.tabs.create({ url: url });
                });
                resultsContainer.appendChild(vidsrcButton);
            }

            if (response.results.Type === 'series') {
                const seasonSelector = document.createElement('select');
                const defaultOption = document.createElement('option');
                defaultOption.textContent = 'Select a season';
                defaultOption.disabled = true;
                defaultOption.selected = true;
                seasonSelector.appendChild(defaultOption);

                for (let i = 1; i <= parseInt(response.results.totalSeasons); i++) {
                    const option = document.createElement('option');
                    option.value = i;
                    option.textContent = `Season ${i}`;
                    seasonSelector.appendChild(option);
                }
                seasonSelector.addEventListener('change', function() {
                    fetchIMDbSeasonDetails(response.results.imdbID, seasonSelector.value);
                });
                resultsContainer.appendChild(seasonSelector);
            }
        } else {
            resultsContainer.innerHTML = 'Failed to load details';
        }
    }

    function fetchIMDbSeasonDetails(imdbID, season) {
        chrome.runtime.sendMessage({ action: 'queryIMDbSeasonDetails', imdbID: imdbID, season: season }, function(response) {
            displaySeasonDetails(response);
        });
    }

    function displaySeasonDetails(response) {
        resultsContainer.innerHTML = '';
        if (response && response.Episodes) {
            var seriesId = response.SeriesID;
            var seasonNumber = response.Season;
            response.Episodes.forEach(episode => {
                const episodeItem = document.createElement('div');
                episodeItem.className = 'result-item';
                episodeItem.innerHTML = `<p>Episode ${episode.Episode}: ${episode.Title}</p>`;
                episodeItem.addEventListener('click', function() {
                    fetchIMDbDetails(episode.imdbID);
                });

                const vidsrcButton = document.createElement('button');
                vidsrcButton.className = 'vidsrc-button'; // Add class for styling
                vidsrcButton.textContent = 'Vidsrc';
                vidsrcButton.addEventListener('click', function() {
                    const base = getDefaultDomain();
                    const episodeNumber = episode.Episode;
                    const url = `${base}/embed/tv/${seriesId}/${seasonNumber}-${episodeNumber}`;
                    chrome.tabs.create({ url: url });
                });
                episodeItem.appendChild(vidsrcButton);

                resultsContainer.appendChild(episodeItem);
            });
        } else {
            resultsContainer.innerHTML = 'Failed to load season details';
        }
    }

    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next';
    nextButton.style.display = 'none'; // Initially hidden
    nextButton.addEventListener('click', function() {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            const currentTab = tabs[0];
            const base = getDefaultDomain();
            const urlPattern = new RegExp(`${base.replace('.', '\\.')}/embed/tv/(.+)/(\\d+)-(\\d+)`);
            const match = currentTab.url.match(urlPattern);
            if (match) {
                const seriesId = match[1];
                const seasonNumber = parseInt(match[2]);
                const episodeNumber = parseInt(match[3]);
                fetchNextEpisode(seriesId, seasonNumber, episodeNumber, base, currentTab.id);
            }
        });
    });
    document.body.appendChild(nextButton);

    function fetchNextEpisode(seriesId, seasonNumber, episodeNumber) {
        const base = arguments[3] || getDefaultDomain();
        const tabId = arguments[4];
        chrome.runtime.sendMessage({ action: 'queryIMDbSeasonDetails', imdbID: seriesId, season: seasonNumber }, function(response) {
            if (response && response.Episodes) {
                const totalEpisodes = response.Episodes.length;
                if (episodeNumber < totalEpisodes) {
                    const nextEpisodeNumber = episodeNumber + 1;
                    const url = `${base}/embed/tv/${seriesId}/${seasonNumber}-${nextEpisodeNumber}`;
                    chrome.tabs.update({ url: url }, function(tab) {
                        if (tabId) sendAutoSettings(tabId);
                    });
                } else {
                    fetchNextSeason(seriesId, seasonNumber, base, tabId);
                }
            }
        });
    }

    function fetchNextSeason(seriesId, seasonNumber) {
        const base = arguments[2] || getDefaultDomain();
        const tabId = arguments[3];
        chrome.runtime.sendMessage({ action: 'queryIMDbDetails', imdbID: seriesId }, function(response) {
            if (response && response.results && response.results.totalSeasons > seasonNumber) {
                const nextSeasonNumber = seasonNumber + 1;
                const url = `${base}/embed/tv/${seriesId}/${nextSeasonNumber}-1`;
                chrome.tabs.update({ url: url }, function(tab) {
                    if (tabId) sendAutoSettings(tabId);
                });
            }
        });
    }

    // Next button display logic is handled after vidsrcBaseURL is set at startup
});