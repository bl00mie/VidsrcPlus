document.addEventListener('DOMContentLoaded', function() {
    console.log('Popup script loaded'); // Debugging line to check script load
    const input = document.getElementById('query');
    const resultsContainer = document.getElementById('results');
    const searchButton = document.getElementById('search-button');

    searchButton.addEventListener('click', function(event) {
        event.preventDefault();
        const query = input.value;
        queryIMDbData(query);
    });

    input.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            const query = input.value;
            queryIMDbData(query);
        }
    });

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
                    const seriesId = response.results.seriesID;
                    const seasonNumber = response.results.Season;
                    const episodeNumber = response.results.Episode;
                    const url = `https://vidsrc.xyz/embed/tv/${seriesId}/${seasonNumber}-${episodeNumber}`;
                    chrome.tabs.create({ url: url });
                });
                resultsContainer.appendChild(vidsrcButton);
            }

            if (response.results.Type === 'movie') {
                const vidsrcButton = document.createElement('button');
                vidsrcButton.textContent = 'Vidsrc';
                vidsrcButton.addEventListener('click', function() {
                    const imdbID = response.results.imdbID;
                    const url = `https://vidsrc.xyz/embed/movie/${imdbID}`;
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
                    const episodeNumber = episode.Episode;
                    const url = `https://vidsrc.xyz/embed/tv/${seriesId}/${seasonNumber}-${episodeNumber}`;
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
            const urlPattern = /https:\/\/vidsrc\.xyz\/embed\/tv\/(.+)\/(\d+)-(\d+)/;
            const match = currentTab.url.match(urlPattern);
            if (match) {
                const seriesId = match[1];
                const seasonNumber = parseInt(match[2]);
                const episodeNumber = parseInt(match[3]);
                fetchNextEpisode(seriesId, seasonNumber, episodeNumber);
            }
        });
    });
    document.body.appendChild(nextButton);

    function fetchNextEpisode(seriesId, seasonNumber, episodeNumber) {
        chrome.runtime.sendMessage({ action: 'queryIMDbSeasonDetails', imdbID: seriesId, season: seasonNumber }, function(response) {
            if (response && response.Episodes) {
                const totalEpisodes = response.Episodes.length;
                if (episodeNumber < totalEpisodes) {
                    const nextEpisodeNumber = episodeNumber + 1;
                    const url = `https://vidsrc.xyz/embed/tv/${seriesId}/${seasonNumber}-${nextEpisodeNumber}`;
                    chrome.tabs.update({ url: url });
                } else {
                    fetchNextSeason(seriesId, seasonNumber);
                }
            }
        });
    }

    function fetchNextSeason(seriesId, seasonNumber) {
        chrome.runtime.sendMessage({ action: 'queryIMDbDetails', imdbID: seriesId }, function(response) {
            if (response && response.results && response.results.totalSeasons > seasonNumber) {
                const nextSeasonNumber = seasonNumber + 1;
                const url = `https://vidsrc.xyz/embed/tv/${seriesId}/${nextSeasonNumber}-1`;
                chrome.tabs.update({ url: url });
            }
        });
    }

    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        const currentTab = tabs[0];
        const urlPattern = /https:\/\/vidsrc\.xyz\/embed\/tv\/(.+)\/(\d+)-(\d+)/;
        if (urlPattern.test(currentTab.url)) {
            nextButton.style.display = 'block'; // Show the Next button
        }
    });
});