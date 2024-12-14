"use strict";

// Setting Up Variables and Modules ////////////////////////////////////////////
const cmd = process.argv;
const readline = require("readline-sync");
const http = require("http");
const path = require("path");
const express = require("express"); 
const app = express(); 
const bodyParser = require("body-parser"); 
app.use(bodyParser.urlencoded({extended:false}));
app.use(express.static(path.join(__dirname, 'public')));
process.stdin.setEncoding("utf8");

app.set("views", path.resolve(__dirname, "templates"));

app.set("view engine", "ejs");

// MongoDB SetUp /////////////////////////////////////////////////////////
require("dotenv").config({ path: path.resolve(__dirname, '.env') });
const uri = `mongodb+srv://${process.env.MONGO_DB_USERNAME}:${process.env.MONGO_DB_PASSWORD}@cluster0.nds20.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const databaseAndCollection = {db: process.env.MONGO_DB_NAME, collection: process.env.MONGO_COLLECTION};
const { MongoClient, ServerApiVersion } = require('mongodb');

// MongoDB Functions /////////////////////////////////////////////////////
async function insertTeamStatsObject(client, databaseAndCollection, newTeamStatsObject) {
    const result = await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).insertOne(newTeamStatsObject);

    //console.log(`Movie entry created with id ${result.insertedId}`);
}

//Handle duplicates
async function lookUpOneEntry(client, databaseAndCollection, teamStatsObject) {
    let filter = { "parameters.league" : teamStatsObject.parameters.league ,
                    "parameters.season" : teamStatsObject.parameters.season ,
                    "parameters.team" : teamStatsObject.parameters.team
    };
    const result = await client.db(databaseAndCollection.db)
                        .collection(databaseAndCollection.collection)
                        .findOne(filter);
    if (result) {
        return true;
    } else {
        return false;
    }
}

async function lookUpMany(client, databaseAndCollection) {
    let filter = { "response.fixtures.wins.total" : -1 };
    const cursor = client.db(databaseAndCollection.db)
    .collection(databaseAndCollection.collection)
    .find().sort(filter);

    const result = await cursor.toArray();
    let table = `<table class="standings"> <tr> <th>Team</th> <th>League</th> <th>Season</th> <th>Games Played</th> <th>Record</th> <th>Goals</th> <th>Conceded</th> <th>Clean Sheets</th> <th>Points</th> </tr>`;
    result.forEach(a => {
        let logo = a.response.team.logo;
        let imageHTML = `<img src="${logo}" alt="" width="22" height="22"></img>`;
        let teamName = a.response.team.name;
        let season = a.response.league.season;
        let league = a.response.league.name;
        let gamesPlayed = a.response.fixtures.played.total;
        let wins = a.response.fixtures.wins.total;
        let draws = a.response.fixtures.draws.total;
        let loses = a.response.fixtures.loses.total;
        let goals = a.response.goals.for.total.total;
        let conceded = a.response.goals.against.total.total;
        let cleanSheets = a.response.clean_sheet.total;
        let points = 3*Number(wins) + Number(draws);

        table += `<tr> <td> ${imageHTML}&nbsp;&nbsp;&nbsp;&nbsp;${teamName}</td> <td>${league}</td> <td>${season}</td> <td>${gamesPlayed}</td> <td>${wins}-${draws}-${loses}</td> <td>${goals}</td> <td>${conceded}</td> <td>${cleanSheets}</td> <b><td>${points}</td></b> </tr>`
    });

    table += ` </table>`;
    return table;
}


if(cmd.length != 3) {
    console.log("Usage supermarketServer.js jsonFile");
    process.exit(0);
}

const portNumber = cmd[2];
const portLink = `http://localhost:${portNumber}`;
app.listen(portNumber);
console.log(`Server started and running at ${portLink}`);

//index.ejs
app.get("/", (request, response) => {
    response.render("index", {port: portLink});
});

// Posting the application details after submit application
const premierLeagueId = 39;
const laLigaId = 140;
const ligue1Id = 61;
const bundesligaId = 78;
const serieAId = 135;
const http_page_file_not_found = 404;
const errorHTML = `<!doctype html>
                    <html lang="en">

                    <head>
                        <meta charset="utf-8" />
                        <title>404 Error</title>
                        <link rel="stylesheet" type="text/css" href="/style.css">
                    </head>

                    <body>
                        <div class="error">
                            <h1 class="errorNumber">404</h1>
                            <h2 class="notFound">Team Not Found</h2>
                            <p class="errorInfo">Make sure you selected the correct league or try spelling the team name differently.</p>
                        </div>

                        <br><br>
                        <div class="home">
                            <a href="/" class="homeText">Go Back</a>
                        </div>
                    </body>

                    </html>`

app.post("/teamStats", (request, response) => {
    let {leagueId, season, team} = request.body;
    
    //Function to get the json corresponding to a teams stats
    async function getTeamStats(leagueId, season, team) {

        // First we get the team's ID (1 API Request)
        const url1 = `https://api-football-v1.p.rapidapi.com/v3/teams?name=${team}&league=${leagueId}&season=${season}`;
        const options1 = {
            method: 'GET',
            headers: {
                'x-rapidapi-key': '0799b5044dmsh58c59449a2317d6p11e55cjsnb07506f57665',
                'x-rapidapi-host': 'api-football-v1.p.rapidapi.com'
            }
        };
        
        try {
            const response1 = await fetch(url1, options1);
            const teamInfoObject = await response1.json();
            
            if((teamInfoObject.errors.length != 0) || (teamInfoObject.response.length == 0)) {
                response.status(http_page_file_not_found);
                response.send(errorHTML);
                return;
            }

            //console.log("Team Info: \n");
            //console.log(JSON.stringify(teamInfoObject));
            let teamId = teamInfoObject.response[0].team.id;

            //Now get the team's stats using the id (1 API Request)
            const url2 = `https://api-football-v1.p.rapidapi.com/v3/teams/statistics?league=${leagueId}&season=${season}&team=${teamId}`;
            const options2 = {
                method: 'GET',
                headers: {
                    'x-rapidapi-key': '0799b5044dmsh58c59449a2317d6p11e55cjsnb07506f57665',
                    'x-rapidapi-host': 'api-football-v1.p.rapidapi.com'
                }
            };
            
            try {
                const response2 = await fetch(url2, options2);
                const teamStatsObject = await response2.json();
                console.log(teamStatsObject);

                //console.log("Team Stats: \n");
                //console.log(JSON.stringify(teamStatsObject));
                
                let logo = teamStatsObject.response.team.logo;
                let teamName = teamStatsObject.response.team.name;
                let gamesPlayed = teamStatsObject.response.fixtures.played.total;
                let wins = teamStatsObject.response.fixtures.wins.total;
                let draws = teamStatsObject.response.fixtures.draws.total;
                let loses = teamStatsObject.response.fixtures.loses.total;
                let goals = teamStatsObject.response.goals.for.total.total;
                let conceded = teamStatsObject.response.goals.against.total.total;
                let cleanSheets = teamStatsObject.response.clean_sheet.total;
                const stats = {logo, teamName, gamesPlayed, wins, draws, loses, goals, conceded, cleanSheets};

                const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
                try {
                    await client.connect();
                
                    /* Inserting one movie */
                    //console.log("***** Inserting one applicant *****");
                    //console.log(newApplicant);
                    let alreadyExists = await lookUpOneEntry(client, databaseAndCollection, teamStatsObject);
                    if(!alreadyExists) {
                        await insertTeamStatsObject(client, databaseAndCollection, teamStatsObject);
                    } else {
                        console.log("Team Stats Object already exists.")
                    }
                    response.render("teamStats", stats);
                } catch (e) {
                    console.error(e);
                    response.status(http_page_file_not_found);
                    response.send(errorHTML);
                    await client.close();
                } finally {
                    await client.close();
                }

            } catch (error) {
                console.error(error);
                response.status(http_page_file_not_found);
                response.send(errorHTML);
                await client.close();
            }


        } catch (error) {
            console.error(error);
            response.status(http_page_file_not_found);
            response.send(errorHTML);
            await client.close();
        }
        
    }
    getTeamStats(leagueId, season, team).catch(console.error);
});

// Posting all team stats after button submit
app.post("/standings", (request, response) => {

    async function main() {
        const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
        try {
            await client.connect();
           
            /* Looking up many applicants */
            let table = await lookUpMany(client, databaseAndCollection);
            response.render("standings", {table});
    
        } catch (e) {
            console.error(e);
        } finally {
            await client.close();
        }
    }
    main().catch(console.error);
});

app.post("/processAdminRemove", (request, response) => {
    async function main() {
        const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
        try {
            await client.connect();
            const result = await client.db(databaseAndCollection.db)
            .collection(databaseAndCollection.collection)
            .deleteMany({});
            response.send(`<!doctype html>
                <html lang="en">
                <head>
                    <meta charset="utf-8" />
                    <title>Application Confirmation</title>
                </head> <body> <h1>Removal Of All Applications</h1> <br>
                All applications have been removed from the database. Number of applications removed: 
                ${result.deletedCount}<br><br><a href="/">HOME</a> </body></html>`);
        } catch (e) {
            console.error(e);
        } finally {
            await client.close();
        }
    }
    main().catch(console.error);
});

process.stdout.write('Stop to shutdown the server: ');
process.stdin.on("readable", function() {
    let input = process.stdin.read();
    input = input.trim();

    if(input == "stop") {
        async function main() {
            const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
            try {
                await client.connect();
                await client.db(databaseAndCollection.db)
                .collection(databaseAndCollection.collection)
                .deleteMany({});
            } catch (e) {
                console.error(e);
            } finally {
                await client.close();
            }
        }
        //main().catch(console.error);
        console.log("Shutting down the server");
        process.exit(0);
    }else{
        console.log(`Invalid Command: ${input}`);
        process.stdout.write('Stop to shutdown the server: ');
        input = process.stdin.read();
    }
})
