// Implement custom logic for restricting QPS - default is 100 queries per 100 second and max 10 queries per second

const axios = require('axios');
const fs = require('fs');

const apiKey = 'AIzaSyD2wPlulvrYbAb4SoK9nYAuWHVU0rrUJwc';
const channelIDs = ['UC0gOw4iy-6HwO01q-gA1B0Q'];
const commentPagesCount = 5;
let comments = [];

channelIDs.forEach(channel => {
        let uploadCollectionID;
        axios.get(`https://www.googleapis.com/youtube/v3/channels?id=${channel}&key=${apiKey}&part=contentDetails`)
            .then(uploadsCollection => {
                uploadCollectionID = uploadsCollection.data.items[0].contentDetails.relatedPlaylists.uploads;
                if (uploadCollectionID) {
                    axios.get(`https://www.googleapis.com/youtube/v3/playlistItems?playlistId=${uploadCollectionID}&key=${apiKey}&part=snippet&maxResults=50`)
                        .then(firstVideos => {
                            let currentNextPageToken = firstVideos.data.nextPageToken;
                            const totalVideos = firstVideos.data.pageInfo.totalResults;
                            const numberOfPages = Math.ceil(totalVideos / 50);
                            let videosIDs = [];

                            firstVideos.data.items.forEach(video => {
                                videosIDs.push(video.snippet.resourceId.videoId);
                            });

                            if (numberOfPages > 1) {
                                for (let i = 1; i <= numberOfPages; i++) {
                                    axios.get(`https://www.googleapis.com/youtube/v3/playlistItems?playlistId=${uploadCollectionID}&key=${apiKey}&part=snippet&maxResults=50&pageToken=${currentNextPageToken}`)
                                        .then(videos => {
                                            videos.data.items.forEach(video => {
                                                videosIDs.push(video.snippet.resourceId.videoId);
                                            });
                                            if (videos.data.nextPageToken) {
                                                currentNextPageToken = videos.data.nextPageToken;
                                            }
                                            if (i === numberOfPages) {
                                                completed(videosIDs);
                                            }
                                        }).catch(() => console.log('Early error'));
                                }
                            } else {
                                completed(videosIDs);
                            }
                        })
                }
            })
            .catch(err => console.error(err))
    }
);

function completed(videosIDs) {
    let counter = 0;
    console.log('Number of videos ' + videosIDs.length);
    videosIDs.forEach(video => {
        counter++;
        axios.get(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&videoId=${video}&key=${apiKey}`)
            .then(commentsData => {
                let currentPageToken = null;
                if (commentsData.data.nextPageToken) {
                    currentPageToken = commentsData.data.nextPageToken;
                }
                commentsData.data.items.forEach(comment => {
                    comments.push(comment.snippet.topLevelComment.snippet.textDisplay);
                });
                if (currentPageToken) {
                    for (let i = 1; i <= commentPagesCount; i++) {
                        axios.get(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&videoId=${video}&key=${apiKey}&pageToken=${currentPageToken}`)
                            .then(commentsPagedData => {
                                commentsPagedData.data.items.forEach(comment => {
                                    comments.push(comment.snippet.topLevelComment.snippet.textDisplay);
                                });
                                if (commentsPagedData.data.nextPageToken) {
                                    currentPageToken = commentsPagedData.data.nextPageToken;
                                } else {
                                    currentPageToken = null;
                                }
                            })
                    }
                }
            }).catch(err => console.log('Far error'));
        if (counter === videosIDs.length) {
            console.log('Final fetching of comments');
            setTimeout(() => {
                fileSave(comments)
            }, 3000)
        }
    })
}

function fileSave(data) {
    let file = fs.createWriteStream('comments.txt');
    file.on('error', err => {
        console.log('[ERROR] - Script was not able to save file.')
    });
    data.forEach(v => {
        file.write(v + '\n');
    });
    file.end();
    console.log(`${data.length} comments was saved into file`)
}
