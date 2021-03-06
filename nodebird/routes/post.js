//이미지 서버에 저장, 게시글 저장 시에는 이미지 주소만 저장 
//클라이언트에는 사진 주소를 통해 view 처리 

const express = require('express');
const multer = require('multer');   //multipart 데이터 업로드 시 필요한 미들웨어 같은 역할 
const path = require('path');
const fs = require('fs');

//라우터에 필요한 모듈들 로드  
const { Post, Hashtag, User } = require('../models');
const { isLoggedIn } = require('./middlewares');

//router 객체 생성 
const router = express.Router();

//1. 업로드 된 이미지 파일 전송받기 
//2. post : 이미지 
//3. post : 이미지 제외한 form data --> DB 저장

//1. 파일읽고 전송받기
//파일 전송받을 디렉토리 생성  
fs.readdir('uploads', (error)=> {
    if(error) {
        console.error('uploads 폴더가 없으므로 하나 생성합니다. ');
        fs.mkdirSync('uploads');
    }
});

//파일 전송 시 설정 multer 에 해주기 
const upload = multer({
    //저장소 관련 설정 
    storage : multer.diskStorage({
        //파일 저장 경로 설정 
        destination(req, file, cb) {
            cb(null, 'uploads/');
        },
        //파일 이름 설정 
        filename(req, file, cb) {
            const ext = path.extname(file.originalname); //원본 파일의 확장자 추출 .js or .html 등 
            //원본파일이름 + 
            cb(null, path.basename(file.originalname, ext) + Date.now() + ext);   //확장자 없엔 원본파일 이름 + 날짜+확장자
        },
    }),
    //파일 크기 제한 
    limits : { fileSize : 5* 1024 * 1024 },
});

//이미지 파일 먼저 post 처리 --> 이미지 저장경로 form 에 response 
router.post('/img', isLoggedIn, upload.single('img'), (req, res) => {
    console.log(req.file);
    res.json({ url : `/img/${req.file.filename}` });
});

//이미지 이외의 form data post 처리 --> DB에 저장 
const upload2 = multer();
router.post('/', isLoggedIn, upload2.none(), async(req, res, next) => {
  try {
    const post = await Post.create({
        content : req.body.content,
        img : req.body.url,
        userId : req.user.id,
    });
    const hashtags = req.body.content.match(/#[^\s]*/g);
    if(hashtags) {
        const result = await Promise.all(hashtags.map(tag => Hashtag.findOrCreate({
            where : { title : tag.slice(1).toLowerCase() },
        })));
        await post.addHashtags(result.map(r => r[0]));
    }
    res.redirect('/');
  } catch (error) {
    console.log(error);
    next(error);
  }
});

//hashtag 흐름 처리 
router.post('/hashtag', async(req, res, next) => {
    const query = req.query.hashtag;    //쿼리 스트링으로 해시태그의 이름을 받고 
    if(!query) {    //해시 태그가 빈 문자열일 경우 : 
        return res.redirect('/');   //메인페이지 redirect 처리 
    }
    try {
        //DB에서 해시 태그 존재하는지 검색 후 
        const hashtag = await Hashtag.findOne({ where : { title : query } });
        let posts = [];
        if(hashtag) {
            //sequelize 의 getPosts([{조건}]) 를 통해서 조건에 맞는 모든 글을 가져온다. 
            posts = await hashtag.getPosts({ include : [{ model : User }] });
        }
        return res.render('main', {
            title : `${query} | NodeBird`,
            user : req.user,
            twits : posts, //조회된 글만 twits 에 넣어서 main 페이지로 렌더링 
        });
    } catch (error) {
        console.log(error);
        return next(error);
    }
});

module.exports = router;