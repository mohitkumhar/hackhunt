const http = require('http');

function makeRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: responseData });
      });
    });
    req.on('error', (e) => reject(e));
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('  HACKHUNT API - FULL ENDPOINT TEST');
  console.log('='.repeat(60));

  // 1. Start Quiz
  console.log('\n--- TEST 1: POST /api/start-quiz ---');
  try {
    const r1 = await makeRequest('POST', '/api/start-quiz', {
      participantId: 'test-player-001',
      username: 'madhav_test',
      eventType: 'quiz',
      year: 1
    });
    console.log(`  STATUS: ${r1.status}`);
    console.log(`  BODY:   ${r1.body}`);
  } catch (e) { console.error('  ERROR:', e.message); }

  // 2. Submit Answer
  console.log('\n--- TEST 2: POST /api/submit-answer ---');
  try {
    const r2 = await makeRequest('POST', '/api/submit-answer', {
      participantId: 'test-player-001',
      username: 'madhav_test',
      questionId: 'q1',
      answer: 'print("hello")',
      timeTaken: 45
    });
    console.log(`  STATUS: ${r2.status}`);
    console.log(`  BODY:   ${r2.body}`);
  } catch (e) { console.error('  ERROR:', e.message); }

  // 3. Fetch Questions
  console.log('\n--- TEST 3: GET /api/questions?eventType=quiz&year=1 ---');
  try {
    const r3 = await makeRequest('GET', '/api/questions?eventType=quiz&year=1');
    console.log(`  STATUS: ${r3.status}`);
    console.log(`  BODY:   ${r3.body}`);
  } catch (e) { console.error('  ERROR:', e.message); }

  // 4. Leaderboard
  console.log('\n--- TEST 4: GET /api/leaderboard?eventType=quiz&year=1 ---');
  try {
    const r4 = await makeRequest('GET', '/api/leaderboard?eventType=quiz&year=1');
    console.log(`  STATUS: ${r4.status}`);
    console.log(`  BODY:   ${r4.body}`);
  } catch (e) { console.error('  ERROR:', e.message); }

  // 5. Start Blind Coding event
  console.log('\n--- TEST 5: POST /api/start-quiz (blind_coding) ---');
  try {
    const r5 = await makeRequest('POST', '/api/start-quiz', {
      participantId: 'blind-coder-001',
      username: 'blind_test_user',
      eventType: 'blind_coding',
      year: 2
    });
    console.log(`  STATUS: ${r5.status}`);
    console.log(`  BODY:   ${r5.body}`);
  } catch (e) { console.error('  ERROR:', e.message); }

  // 6. Execute Code
  console.log('\n--- TEST 6: POST /api/execute (Python) ---');
  try {
    const r6 = await makeRequest('POST', '/api/execute', {
      language: 'python',
      version: '3.12',
      files: [{ content: 'print("Hello from HackHunt!")' }]
    });
    console.log(`  STATUS: ${r6.status}`);
    console.log(`  BODY:   ${r6.body}`);
  } catch (e) { console.error('  ERROR:', e.message); }

  console.log('\n' + '='.repeat(60));
  console.log('  ALL TESTS COMPLETE');
  console.log('='.repeat(60));
}

runTests();
