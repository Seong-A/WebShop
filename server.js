const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
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

app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            res.status(500).json({ success: false, message: 'Server Error' });
        } else {
            res.json({ success: true, message: '로그아웃 성공' });
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

app.get('/check-master', (req, res) => {
    const masterId = 'master';

    if (req.session.isLoggedIn && req.session.userId === masterId) {
        res.json({ isMaster: true });
    } else {
        res.json({ isMaster: false });
    }
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads');
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        cb(null, 'picture-' + Date.now() + ext);
    }
});

const upload = multer({ storage: storage });

app.post('/submit-popup', upload.single('picture'), (req, res) => {
    const title = req.body.title;
    const location = req.body.location;
    const date = req.body.date;
    const category = req.body.category;
    const detail = req.body.detail;
    const picturePath = req.file ? req.file.path : null;

    const insertQuery = 'INSERT INTO popup_store (title, location, date, category, detail, picture_path) VALUES (?, ?, ?, ?, ?, ?)';
    const insertValues = [title, location, date, category, detail, picturePath];

    connection.query(insertQuery, insertValues, (insertError, insertResults, insertFields) => {
        if (insertError) {
            console.error('게시물 등록 오류:', insertError);
            res.status(500).json({ success: false, message: '게시물 등록 실패' });
        } else {
            console.log('게시물 등록 성공');
            res.status(200).json({ success: true, message: '게시물 등록 성공' });
        }
    });
});

app.get('/get-popup-data', (req, res) => {
    const query = 'SELECT id, title, location, date, picture_path FROM popup_store';
    
    connection.query(query, (error, results, fields) => {
        if (error) {
            console.error('팝업 데이터 가져오기 오류:', error);
            res.status(500).json({ success: false, message: '내부 서버 오류' });
        } else {
            res.status(200).json(results);
        }
    });
});

app.get('/get-popup-detail', (req, res) => {
    const popupId = req.query.id; 
    if (!popupId) {
        res.status(400).json({ success: false, message: '팝업 ID가 제공되지 않았습니다.' });
        return;
    }

    const query = 'SELECT id, title, location, date, category, detail, picture_path FROM popup_store WHERE id = ?';
    
    connection.query(query, [popupId], (error, results, fields) => {
        if (error) {
            console.error('팝업 데이터 가져오기 오류:', error);
            res.status(500).json({ success: false, message: '내부 서버 오류' });
        } else {
            if (results.length > 0) {
                res.status(200).json(results[0]); 
            } else {
                res.status(404).json({ success: false, message: '해당 ID의 팝업을 찾을 수 없음' });
            }
        }
    });
});

async function saveLikeToDatabase(userId, popupId, isLiked) {
    try {
        const query = 'INSERT INTO user_likes (user_id, popup_id, is_liked) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE is_liked = VALUES(is_liked)';
        const values = [userId, popupId, isLiked];
        await connection.query(query, values);
        console.log(`User ${userId} ${isLiked ? 'liked' : 'unliked'} Popup ${popupId}`);
    } catch (error) {
        console.error('Error saving like to database:', error);
    }
}

app.post('/like-popup', async (req, res) => {
    const { popupId, isLiked } = req.body;

    // 로그인 여부 확인
    if (!req.session.isLoggedIn) {
        return res.status(401).json({ success: false, message: '로그인되지 않은 사용자' });
    }

    const userId = req.session.userId;

    try {
        await saveLikeToDatabase(userId, popupId, isLiked);
        res.json({ success: true });
    } catch (error) {
        console.error('Error handling like:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

app.get('/check-popup-like', async (req, res) => {
    try {
        const { id: popupId } = req.query; 

        if (!req.session.isLoggedIn) {
            return res.status(401).json({ success: false, message: '로그인되지 않은 사용자' });
        }
    
        const userId = req.session.userId;
        const isLiked = await checkIfPopupIsLikedFromDatabase(userId, popupId);

        res.json({ isLiked });
    } catch (error) {
        console.error('Error in check-popup-like route:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

async function checkIfPopupIsLikedFromDatabase(userId, popupId) {
    try {
        const query = 'SELECT is_liked FROM user_likes WHERE user_id = ? AND popup_id = ?';
        const result = await connection.query(query, [userId, popupId]);

        return result.length > 0 ? result[0].is_liked === 1 : false;
    } catch (error) {
        console.error('Error in checkIfPopupIsLikedFromDatabase:', error);
        throw error;
    }
}


process.on('SIGINT', () => {
    connection.end();
    process.exit();
});
