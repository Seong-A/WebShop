const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const mysqlModule = require('./mysql');
const app = express();
const port = 5500;

const connection = mysqlModule.getConnection();

app.use(session({
    secret: 'your-secret-key', 
    resave: false,
    saveUninitialized: true
}));

app.listen(5500, function(){
    console.log('listening on 5500');
});

app.use(express.static('public'));
app.use(bodyParser.json());

app.post('/register', (req, res) => {
    const userData = req.body;

    const query = 'INSERT INTO user (id, password, name, phone) VALUES (?, ?, ?, ?)';
    const values = [userData.id, userData.password, userData.name, userData.phone];

    connection.query(query, values, (error, results, fields) => {
        if (error) {
            console.error('사용자 등록 오류:', error);
            res.status(500).json({ success: false, message: '내부 서버 오류' });
        } else {
            console.log('사용자 등록 성공');
            res.status(200).json({ success: true, message: '사용자 등록 성공' });
        }
    });
});

app.post('/login', (req, res) => {
    const userData = req.body;

    const query = 'SELECT * FROM user WHERE id = ? AND password = ?';
    const values = [userData.id, userData.password];

    connection.query(query, values, (error, results, fields) => {
        if (error) {
            console.error('로그인 오류:', error);
            res.status(500).json({ success: false, message: '내부 서버 오류' });
        } else {
            if (results.length > 0) {
                req.session.isLoggedIn = true;
                req.session.userId = results[0].id;
                console.log('로그인 성공');
                res.status(200).json({ success: true, message: '로그인 성공' });
            } else {
                console.log('로그인 실패');
                res.status(401).json({ success: false, message: '로그인 실패' });
            }
        }
    });
});

app.get('/check-login', (req, res) => {
    res.json({ isLoggedIn: req.session.isLoggedIn, userId: req.session.userId });
});

app.post('/set-session', (req, res) => {
    const { isLoggedIn, userId } = req.body;
    req.session.isLoggedIn = isLoggedIn;
    req.session.userId = userId;
    res.json({ success: true });
});

app.get('/get-user-info', (req, res) => {
    if (req.session.isLoggedIn) {
        const userId = req.session.userId;

        const query = 'SELECT name FROM user WHERE id = ?';
        
        connection.query(query, [userId], (error, results, fields) => {
            if (error) {
                console.error('사용자 정보 가져오기 오류:', error);
                res.status(500).json({ success: false, message: '내부 서버 오류' });
            } else {
                if (results.length > 0) {
                    const username = results[0].name;
                    res.json({ username });
                } else {
                    res.status(404).json({ message: '사용자 정보를 찾을 수 없음' });
                }
            }
        });
    } else {
        res.status(401).json({ message: '로그인되지 않은 사용자' });
    }
});


process.on('SIGINT', () => {
    connection.end();
    process.exit();
});
