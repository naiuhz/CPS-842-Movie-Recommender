// Express Server 

"use strict";

// Import Modules
const express = require('express');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const spawn = require("child_process").spawn;

var availableUsers = JSON.parse(fs.readFileSync("./data/availableUsers.json")),
    movieData = JSON.parse(fs.readFileSync('./data/filteredData.json')),
    recommendationScores = JSON.parse(fs.readFileSync("./data/recommendations.json"));


const app = express();
app.use(compression());
app.use(express.json());
app.use(cookieParser());
const PORT = 8888;

app.listen(PORT, () => {
    console.log(`Server Setup Listening on Port ${PORT}`);
});

app.post("/create-user", async (req, res) => {
    if (!req.body.username) return res.status(403).end();
    try {
        let tempUserID = getRandomID();
        availableUsers[tempUserID] = req.body.username;
        saveData(tempUserID);
        res.cookie('userID', tempUserID);
        res.cookie('userName', req.body.username);
        res.status(200).send({
            success: true
        });
    } catch (e) {
        console.log(e);
        res.status(200).send({
            success: false
        });
    }
});

app.post('/login', async (req, res) => {
    if (!req.body.username) return res.status(403).end();
    try {
        for (let tempUserID in availableUsers) {
            if (availableUsers[tempUserID] === req.body.username) {
                res.cookie('userID', tempUserID);
                res.cookie('userName', req.body.username);
                return res.status(200).send({
                    success: true
                });
            }
        };
        res.status(200).send({
            success: false
        });
    } catch (e) {
        console.log(e);
        res.status(200).send({
            success: false
        });
    }
})

app.post("/add-rating", async (req, res) => {
    if (!req.cookies.userID || !req.body.movieID) return res.status(200).send({
        success: false
    });
    try {
        movieData[req.body.movieID].ratings[req.cookies.userID] = parseFloat(req.body.rating);
        saveData(req.cookies.userID);
        res.status(200).send({
            success: true
        });
    } catch (e) {
        console.log(e);
        res.status(200).send({
            success: false
        });
    }
});

app.get("/public/*", async (req, res) => {
    return res.sendFile(path.join(__dirname, decodeURIComponent(req.path)));
})

app.get("/", async (req, res) => {
    if (req.cookies.userID) {
        let tempHTML = fs.readFileSync(path.join(__dirname, "public/landing-page-logged-in.html")).toString().replace("REPLACE USERNAME", req.cookies.userName);
        return res.status(200).send(tempHTML);
    };
    return res.sendFile(path.join(__dirname, "public/landing-page-logged-out.html"));
});

app.get("/login", async (req, res) => {
    return res.sendFile(path.join(__dirname, "public/login-page.html"));
});

app.get("/about-us", async (req, res) => {
    return res.sendFile(path.join(__dirname, "public/about-us.html"));
});

app.get("/movie/*", async (req, res) => {
    try {
        const movieID = req.path.split("/movie/")[1],
            tempMovieData = movieData[movieID];
        if (!tempMovieData) return res.status(404).send("Invalid Movie ID");
        // Calculations
        let averageRating = 0,
            ratingCounter = 0;
        for (let tempRating in tempMovieData.ratings) {
            averageRating += tempMovieData.ratings[tempRating];
            ratingCounter++;
        };
        averageRating = (averageRating / ratingCounter).toFixed(1);

        let movieRecommendations = recommendationScores[tempMovieData.title];


        // Update HTML
        let formattedHTML;
        if (req.cookies.userID) formattedHTML = fs.readFileSync(path.join(__dirname, "public/movie-page-logged-in.html")).toString().replace("REPLACE USERNAME", req.cookies.userName);
        else formattedHTML = fs.readFileSync(path.join(__dirname, "public/movie-page-logged-out.html")).toString();

        formattedHTML = formattedHTML.replace("AVERAGE RATING HERE", averageRating);
        formattedHTML = formattedHTML.replace("META SCORE HERE", tempMovieData.movieInfo.metaScore);
        formattedHTML = formattedHTML.replace("IMDB SCORE HERE", tempMovieData.movieInfo.IMDbRating);
        formattedHTML = formattedHTML.replace("MOVIE TIME HERE", tempMovieData.movieInfo.runTime);
        formattedHTML = formattedHTML.replace("IMAGE HERE", tempMovieData.movieInfo.image);
        formattedHTML = formattedHTML.replace("MOVIE TITLE HERE", tempMovieData.title);

        let counter = 1;

        for (let tempMovie in movieRecommendations) {
            formattedHTML = formattedHTML.replace("Movie TITLE " + counter, tempMovie);
            formattedHTML = formattedHTML.replace("MOVIE PERCENTAGE " + counter, (movieRecommendations[tempMovie] * 100).toFixed(2));
            for (let tempMovieID in movieData) {
                if (movieData[tempMovieID].title === tempMovie) {
                    formattedHTML = formattedHTML.replace("MOVIE ID " + counter, tempMovieID);
                    break;
                };
            }
            counter++;
        };


        res.setHeader('content-type', 'text/html; charset=UTF-8');
        res.status(200).send(formattedHTML);
    } catch (e) {
        console.log(e);
        res.status(200).send({
            success: false
        });
    }
});

async function saveData(userID) {
    fs.writeFileSync('./data/availableUsers.json', JSON.stringify(availableUsers, null, 2));
    fs.writeFileSync('./data/filteredData.json', JSON.stringify(movieData, null, 2));
    let tempCSVFile = ["userId,movieId,ratings,title"];
    for (let tempMovieID in movieData) {
        for (let tempUserID in movieData[tempMovieID].ratings) {
            tempCSVFile.push(`${tempUserID},${tempMovieID},${movieData[tempMovieID].ratings[tempUserID]},${movieData[tempMovieID].title}`);
        }
    }
    fs.writeFileSync("./data/dataForItemBased.csv", tempCSVFile.join("\n"));

    // Here call recommendation calculations
    const pythonProcess = spawn('python', ["./itemBasedRec.py", userID]);

    pythonProcess.on('close', () => {
        recommendationScores = JSON.parse(fs.readFileSync('./data/recommendations.json'));
    })
};

function getRandomID(min = 600, max = 1000) { // Get random ID
    return Math.floor(Math.random() * (max - min + 1) + min);
};