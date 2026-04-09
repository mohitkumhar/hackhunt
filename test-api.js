const http = require('http');

const data = JSON.stringify({
  participantId: "player999",
  username: "madhav_the_goat",
  eventType: "quiz",
  year: 1
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/start-quiz',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let responseData = '';
  res.on('data', (chunk) => { responseData += chunk; });
  res.on('end', () => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`BODY: ${responseData}`);
  });
});

req.on('error', (e) => { console.error(`problem with request: ${e.message}`); });

req.write(data);
req.end();
