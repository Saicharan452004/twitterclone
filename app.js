const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const app = express()
app.use(express.json())
const dbpath = path.join(__dirname, 'twitterClone.db')
let db = null
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('server running')
    })
  } catch (e) {
    console.log(`Db error:${e.message}`)
    process.exit(1)
  }
}
initializeDbAndServer()
const convertToObject = dbObject => {
  return {
    username: dbObject.username,
    tweet: dbObject.tweet,
    dateTime: dbObject.date_time,
  }
}

const convertToObject2 = dbObject => {
  return {
    tweet: dbObject.tweet,
    likes: dbObject.likes,
    replies: dbObject.replies,
    dateTime: dbObject.date_time,
  }
}

const convertToObject3 = dbObject => {
  return {
    likes: dbObject,
  }
}

const convertToObject4 = dbObject => {
  return {
    replies: dbObject,
  }
}
const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}

//API1 REGISTER BY POST
app.post('/register/', async (request, response) => {
  const {username, password, name, gender} = request.body
  const query = `select * from user where username="${username}"`
  const result = await db.get(query)
  if (result !== undefined) {
    response.status(400)
    response.send('User already exists')
  } else {
    if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      const hashedPassword = await bcrypt.hash(password, 10)
      const query = `insert into user(name,username,password,gender) values("${name}","${username}","${hashedPassword}","${gender}")`
      const result = await db.run(query)
      response.status(200)
      response.send('User created successfully')
    }
  }
})

//API2 LOGIN BY POST
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const query = `select * from user where username="${username}"`
  const result = await db.get(query)
  if (result === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, result.password)
    if (isPasswordMatched) {
      const payload = {username: username}
      let jwtToken = jwt.sign(payload, 'MY_SECRET')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//API3
app.get('/user/tweets/feed', authenticateToken, async (request, response) => {
  const {username} = request
  const query = `select user_id from user where username="${username}"`
  const result = await db.get(query)
  const {user_id} = result
  const query2 = `select user.username,tweet.tweet,tweet.date_time
   from user inner join tweet on user.user_id=tweet.user_id inner join
    follower on user.user_id=follower.following_user_id
    where follower.follower_user_id=${user_id}
    order by tweet.date_time desc limit 4`
  const result2 = await db.all(query2)
  response.send(result2.map(eachObject => convertToObject(eachObject)))
})

//API4
app.get('/user/following/', authenticateToken, async (request, response) => {
  const {username} = request
  const query = `select user_id from user where username="${username}"`
  const result = await db.get(query)
  const {user_id} = result
  const twwetQuery = `select name from user inner join follower on 
  user.user_id=follower.following_user_id where follower.follower_user_id="${user_id}"`
  const result2 = await db.all(twwetQuery)
  response.send(result2)
})

//API5
app.get('/user/followers/', authenticateToken, async (request, response) => {
  const {username} = request
  const query = `select user_id from user where username="${username}"`
  const result = await db.get(query)
  const {user_id} = result
  const twwetQuery = `select name from user inner join follower on 
  user.user_id=follower.follower_user_id where follower.following_user_id="${user_id}"`
  const result2 = await db.all(twwetQuery)
  response.send(result2)
})

//API6
app.get('/tweets/:tweetId', authenticateToken, async (request, response) => {
  const {tweetId} = request.params
  const {username} = request
  const userIdquery = `select user_id from user where username="${username}"`
  const userIdresult = await db.get(userIdquery)
  const {user_id} = userIdresult
  const tweetQuery = `select tweet.tweet,
  count(distinct like.like_id) as likes,
  count(distinct reply.reply_id) as replies,
  tweet.date_time from follower 
  inner join tweet on tweet.user_id=follower.following_user_id 
  left join like on like.tweet_id=tweet.tweet_id
  left join reply on reply.tweet_id=tweet.tweet_id
  where tweet.tweet_id=${tweetId} and follower.follower_user_id=${user_id} 
  group by tweet.tweet_id,tweet.tweet,tweet.date_time`
  const tweetResult = await db.get(tweetQuery)
  if (tweetResult === undefined) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    response.send(convertToObject2(tweetResult))
  }
})

//API7
app.get(
  '/tweets/:tweetId/likes/',
  authenticateToken,
  async (request, response) => {
    const {tweetId} = request.params
    const {username} = request
    const userIdquery = `select user_id from user where username="${username}"`
    const userIdresult = await db.get(userIdquery)
    const {user_id} = userIdresult
    const tweetQuery = `select user.username from like inner join tweet on like.tweet_id=tweet.tweet_id 
    inner join follower on tweet.user_id=follower.following_user_id 
    inner join user on like.user_id=user.user_id 
    where tweet.tweet_id=${tweetId} and follower.follower_id=${user_id}`
    const tweetResult = await db.all(tweetQuery)
    if (tweetResult.length === 0) {
      response.status(401)
      response.send('Invalid Request')
    } else {
      const arrayOfNames = tweetResult.map(obj => obj.username)
      response.send(convertToObject3(arrayOfNames))
    }
  },
)

//API 8
app.get(
  '/tweets/:tweetId/replies/',
  authenticateToken,
  async (request, response) => {
    const {tweetId} = request.params
    const {username} = request
    const userIdquery = `select user_id from user where username="${username}"`
    const userIdresult = await db.get(userIdquery)
    const {user_id} = userIdresult
    const tweetQuery = `select user.name,reply.reply from reply inner join tweet on reply.tweet_id=tweet.tweet_id 
    inner join follower on tweet.user_id=follower.following_user_id 
    inner join user on reply.user_id=user.user_id 
    where tweet.tweet_id=${tweetId} and follower.follower_id=${user_id}`
    const tweetResult = await db.all(tweetQuery)
    if (tweetResult.length === 0) {
      response.status(401)
      response.send('Invalid Request')
    } else {
      response.send(convertToObject4(tweetResult))
    }
  },
)
//API9
app.get('/user/tweets/', authenticateToken, async (request, response) => {
  const {username} = request
  const userIdquery = `select user_id from user where username="${username}"`
  const userIdresult = await db.get(userIdquery)
  const {user_id} = userIdresult
  const tweetQuery = `select tweet.tweet,
  count(distinct like.like_id) as likes,
  count(distinct reply.reply_id) as replies,
  tweet.date_time from user 
  inner join tweet on tweet.user_id=user.user_id 
  left join like on like.tweet_id=tweet.tweet_id
  left join reply on reply.tweet_id=tweet.tweet_id
  where user.user_id=${user_id} 
  group by tweet.tweet_id,tweet.tweet,tweet.date_time`
  const tweetResult = await db.all(tweetQuery)
  response.send(tweetResult.map(eachObject => convertToObject2(eachObject)))
})

//API 10
app.post('/user/tweets/', authenticateToken, async (request, response) => {
  const {tweet} = request.body
  const query = `insert into tweet(tweet) values("${tweet}")`
  const result = await db.run(query)
  response.send('Created a Tweet')
})
//API11
app.delete('/tweets/:tweetId', authenticateToken, async (request, response) => {
  const {tweetId} = request.params
  const {username} = request
  const userIdquery = `select user_id from user where username="${username}"`
  const userIdresult = await db.get(userIdquery)
  const {user_id} = userIdresult
  const tweetQuery = `select tweet_id from tweet where user_id=${user_id} and tweet_id=${tweetId}`
  const resultQuery = await db.get(tweetQuery)
  console.log(resultQuery)
  if (resultQuery === undefined) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    tweetDeleteQuery = `delete from tweet where user_id=${user_id} and tweet_id=${tweetId}`
    const result = await db.run(tweetDeleteQuery)
    response.send('Tweet Removed')
  }
})

module.exports = app
