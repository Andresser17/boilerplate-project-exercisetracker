const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

// Database connection
const db = async () =>
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

db().catch((err) => console.log(err));

// Declared schemas
const exerciseSchema = new mongoose.Schema({
  description: String,
  duration: Number,
  date: String,
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  log: [exerciseSchema],
});

// Declared models
const User = new mongoose.model("User", userSchema);

// Declared methods
const getAllUsers = () => {
  const listOfUsers = User.find({}, ["username", "_id"]);

  return listOfUsers;
};

const createUser = (username) => {
  const user = new User({
    username,
  });

  return user.save();
};

const addExerciseToUser = async (_id, description, duration, date) => {
  const user = await User.findOne({ _id });

  // Test if user exist
  if (!user) return { error: "username not found" };

  // Test if description and duration were provided
  if (description.length === 0 || Number(duration) <= 0)
    return {
      error: "description or duration not were provided",
    };

  // Test if date was pass to funct
  let newDate = new Date().toDateString();

  if (date) {
    const day = date.split("-")[2];
    const month = date.split("-")[1] - 1;
    const year = date.split("-")[0];

    // Year Day Month
    newDate = new Date(year, month, day).toDateString();
  }

  const exercise = {
    description,
    duration: Number(duration),
    date: newDate,
  };

  user.log.push(exercise);

  if (!(await user.save())) return { error: "exercise not save, try again" };

  return {
    username: user.username,
    description: exercise.description,
    duration: exercise.duration,
    date: exercise.date,
    _id: user._id,
  };
};

const deleteExercises = async (_id, logId) => {
  const user = await User.findOne({ _id });

  user.log = user.log.filter((item) => {
    if (item.duration === null || item.description === "") {
      return false;
    } else return true;
  });

  // await user.save();
};
// deleteExercises("61c0ceb68de38dbb2f5d8c04", "61c0f2e44ef137f279d86bab");

const filterExercises = (log, from, to, limit) => {
  let newLog = [...log];

  if (from || to) {
    const filtered = newLog.filter((item) => {
      // transform to the format YY-MM-DD
      const date = new Date(item.date);

      const day = date.getDate();
      const month = date.getMonth() + 1;
      const year = date.getFullYear();

      const fullDate = Number(`${year}${month}${day}`);
      const intFrom = from ? Number(from.replace(/-+/g, "")) : false;
      const intTo = to ? Number(to.replace(/-+/g, "")) : false;

      const cond =
        from && !to
          ? fullDate >= intFrom
          : to && !from
          ? fullDate <= intTo
          : fullDate >= intFrom && fullDate <= intTo;

      if (cond) return true;
      else return false;
    });

    newLog = [...filtered];
  }

  if (limit) {
    newLog = log.slice(0, limit);
  }

  return newLog;
};

const getUserExercises = async (_id, from, to, limit) => {
  const user = await User.findOne(
    { _id },
    {
      username: true,
      _id: true,
      // "log.description": true,
      // "log.duration": true,
      // "log.date": true,
      log: { description: true, duration: true, date: true },
    }
  );

  // Apply filter to the exercises fetched
  const newUser = { ...user._doc };
  if (from || to || limit) {
    const filtered = filterExercises(user.log, from, to, limit);

    newUser.count = filtered.length;
    newUser.log = filtered;

    return newUser;
  }

  newUser.count = user.log.length;

  return newUser;
};

// Configure express to use bodyParser as middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(cors());
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

app
  .route("/api/users")
  // Fetch all users
  .get(async (req, res) => {
    const listOfUsers = await getAllUsers();

    res.json(listOfUsers);
  })
  // Create new user
  .post(async (req, res) => {
    const username = req.body.username;

    createdUser = await createUser(username);

    res.json({ username: createdUser.username, _id: createdUser._id });
  });

// 61c0ceb68de38dbb2f5d8c04
app.post("/api/users/:_id/exercises", async (req, res) => {
  const _id = req.body[":_id"];
  const description = req.body.description;
  const duration = req.body.duration;
  const date = req.body.date;

  const addedExercise = await addExerciseToUser(
    _id,
    description,
    duration,
    date
  );

  res.json({
    username: addedExercise.username,
    description: addedExercise.description,
    duration: addedExercise.duration,
    date: addedExercise.date,
    _id: addedExercise._id,
  });
});

app.get(
  "/api/users/:_id/logs?:from?:to?:limit",
  async (req, res, next) => {
    const _id = req.params["_id"];
    const from = req.query.from;
    const to = req.query.to;
    const limit = req.query.limit;

    req.user = await getUserExercises(_id, from, to, limit);
    next();
  },
  (req, res) => {
    res.json(req.user);
  }
);

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
