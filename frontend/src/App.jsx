import { useEffect, useMemo, useState } from "react";
import "./App.css";

export default function App() {
  const [page, setPage] = useState("auth");
  const [userId, setUserId] = useState(null);
  const [user, setUser] = useState(null);

  const [foods, setFoods] = useState([]);
  const [search, setSearch] = useState("");
  const [mealFilter, setMealFilter] = useState("All");
  const [goalFilter, setGoalFilter] = useState("All");
  const [dietFilter, setDietFilter] = useState("All");
  const [regionFilter, setRegionFilter] = useState("All");

  const [dailyDiet, setDailyDiet] = useState({
    breakfast: [],
    lunch: [],
    snack: [],
    dinner: [],
  });

  const [weeklyDiet, setWeeklyDiet] = useState([]);
  const [savedPlans, setSavedPlans] = useState([]);
  const [progressWeight, setProgressWeight] = useState("");
  const [progressList, setProgressList] = useState([]);
  const [chatMessage, setChatMessage] = useState("");
  const [chatReply, setChatReply] = useState("");

  const [signupData, setSignupData] = useState({
    username: "",
    password: "",
  });

  const [loginData, setLoginData] = useState({
    username: "",
    password: "",
  });

  const [profile, setProfile] = useState({
    age: "",
    gender: "",
    weight: "",
    height: "",
    goal: "",
    diet_type: "",
  });

  const mealTimings = {
    breakfast: "8:00 AM",
    lunch: "1:00 PM",
    snack: "5:00 PM",
    dinner: "8:00 PM",
  };

  useEffect(() => {
    fetch("http://127.0.0.1:5000/foods")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setFoods(data);
        } else if (data.foods_dataset) {
          setFoods(data.foods_dataset);
        } else {
          setFoods([]);
        }
      })
      .catch(() => setFoods([]));
  }, []);

  const fetchUser = async (id) => {
    const res = await fetch(`http://127.0.0.1:5000/user/${id}`);
    const data = await res.json();
    setUser(data);

    if (data?.goal) setGoalFilter(data.goal);
    if (data?.diet_type) setDietFilter(data.diet_type);

    return data;
  };

  const fetchSavedPlans = async (id) => {
    const res = await fetch(`http://127.0.0.1:5000/plans/${id}`);
    const data = await res.json();
    setSavedPlans(Array.isArray(data) ? data : []);
  };

  const fetchProgress = async (id) => {
    const res = await fetch(`http://127.0.0.1:5000/progress/${id}`);
    const data = await res.json();
    setProgressList(Array.isArray(data) ? data : []);
  };

  const handleSignup = async () => {
    const res = await fetch("http://127.0.0.1:5000/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(signupData),
    });

    const data = await res.json();
    alert(data.message);
  };

  const handleLogin = async () => {
    const res = await fetch("http://127.0.0.1:5000/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(loginData),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Login failed");
      return;
    }

    setUserId(data.user_id);
    const userData = await fetchUser(data.user_id);
    await fetchSavedPlans(data.user_id);
    await fetchProgress(data.user_id);

    if (
      !userData.age ||
      !userData.gender ||
      !userData.weight ||
      !userData.height ||
      !userData.goal ||
      !userData.diet_type
    ) {
      setPage("profile");
    } else {
      setPage("dashboard");
    }
  };

  const handleProfileSave = async () => {
    const res = await fetch("http://127.0.0.1:5000/save-profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        ...profile,
      }),
    });

    const data = await res.json();
    alert(data.message);

    if (res.ok) {
      await fetchUser(userId);
      setPage("dashboard");
    }
  };

  const bmi = useMemo(() => {
    if (!user?.weight || !user?.height) return null;
    const h = Number(user.height) / 100;
    const w = Number(user.weight);
    if (!h || !w) return null;
    return (w / (h * h)).toFixed(2);
  }, [user]);

  const bmiStatus = useMemo(() => {
    if (!bmi) return "";
    const value = Number(bmi);
    if (value < 18.5) return "Underweight";
    if (value < 25) return "Normal";
    if (value < 30) return "Overweight";
    return "Obese";
  }, [bmi]);

  const calorieTarget = useMemo(() => {
    if (!user) return 0;

    const weight = Number(user.weight) || 0;
    const height = Number(user.height) || 0;
    const age = Number(user.age) || 0;
    const gender = (user.gender || "").toLowerCase();

    let bmr = 0;
    if (gender === "male") {
      bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
      bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }

    let target = bmr * 1.4;

    if (user.goal === "Weight Loss") target -= 300;
    if (user.goal === "Weight Gain") target += 300;
    if (user.goal === "Muscle Gain") target += 200;

    return Math.round(target);
  }, [user]);

  const scoreFood = (food, goal) => {
    const calories = Number(food.Calories_per_100g) || 0;
    const protein = Number(food.Protein_g) || 0;
    const fiber = Number(food.Fiber_g) || 0;
    const fat = Number(food.Fat_g) || 0;
    const sugar = Number(food.Sugar_g) || 0;

    if (goal === "Weight Loss") {
      return protein * 3 + fiber * 2 - calories * 0.5 - fat * 0.3 - sugar * 0.2;
    }

    if (goal === "Weight Gain") {
      return calories * 1.5 + protein * 2 + fat * 0.5 + fiber * 0.2;
    }

    if (goal === "Muscle Gain") {
      return protein * 3.5 + calories * 0.7 + fiber * 0.5;
    }

    return protein + fiber + calories * 0.2;
  };

  const getBenefits = (food) => {
    if (!food) return "";
    const protein = Number(food.Protein_g) || 0;
    const calories = Number(food.Calories_per_100g) || 0;
    const fiber = Number(food.Fiber_g) || 0;

    if (protein >= 20) return "High protein, good for muscle support";
    if (fiber >= 5) return "High fiber, helps fullness and digestion";
    if (calories <= 150) return "Lower calorie option, useful for weight control";
    if (calories >= 250) return "High energy option, useful for weight gain";
    return "Balanced nutrition option";
  };

  const getQuantity = (food, goal, mealName) => {
    if (!food) return { grams: 0, note: "" };

    const calories = Number(food.Calories_per_100g) || 0;
    const protein = Number(food.Protein_g) || 0;

    let grams = 100;

    if (goal === "Weight Loss") {
      grams = protein >= 20 ? 120 : calories <= 150 ? 150 : 100;
    } else if (goal === "Weight Gain") {
      grams = calories >= 250 ? 180 : 150;
    } else if (goal === "Muscle Gain") {
      grams = protein >= 20 ? 180 : 150;
    }

    if (mealName === "Snack") {
      grams = Math.round(grams * 0.7);
    }

    return {
      grams,
      note: `${grams}g recommended intake`
    };
  };

  const getFoodImage = (food) => {
    return food?.Image_URL || "/images/default-food.jpg";
  };

  const uniqueRegions = [
    "All",
    ...new Set(foods.map((item) => item.Region).filter(Boolean)),
  ];

  const filteredFoods = useMemo(() => {
    return foods.filter((item) => {
      const matchesSearch = (item.Food_Item || "")
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesMeal =
        mealFilter === "All" ||
        (item.Meal_Time || "").toLowerCase() === mealFilter.toLowerCase();

      const matchesGoal =
        goalFilter === "All" ||
        (item.Goal || "").toLowerCase() === goalFilter.toLowerCase();

      const matchesDiet =
        dietFilter === "All" ||
        dietFilter === "Both" ||
        (item.Diet_Type || "").toLowerCase() === dietFilter.toLowerCase();

      const matchesRegion =
        regionFilter === "All" ||
        (item.Region || "").toLowerCase() === regionFilter.toLowerCase();

      return (
        matchesSearch &&
        matchesMeal &&
        matchesGoal &&
        matchesDiet &&
        matchesRegion
      );
    });
  }, [foods, search, mealFilter, goalFilter, dietFilter, regionFilter]);

  const getMealPool = (mealName) => {
    let pool = foods.filter((item) => {
      const mealMatch =
        (item.Meal_Time || "").toLowerCase() === mealName.toLowerCase();

      const goalMatch =
        goalFilter === "All"
          ? (!user?.goal || (item.Goal || "").toLowerCase() === user.goal.toLowerCase())
          : (item.Goal || "").toLowerCase() === goalFilter.toLowerCase();

      const dietMatch =
        dietFilter === "All" ||
        dietFilter === "Both"
          ? true
          : (item.Diet_Type || "").toLowerCase() === dietFilter.toLowerCase();

      const regionMatch =
        regionFilter === "All" ||
        (item.Region || "").toLowerCase() === regionFilter.toLowerCase();

      return mealMatch && goalMatch && dietMatch && regionMatch;
    });

    if (pool.length === 0) {
      pool = foods.filter(
        (item) => (item.Meal_Time || "").toLowerCase() === mealName.toLowerCase()
      );
    }

    if (pool.length === 0) {
      pool = foods;
    }

    return [...pool].sort(
      (a, b) =>
        scoreFood(b, goalFilter === "All" ? user?.goal : goalFilter) -
        scoreFood(a, goalFilter === "All" ? user?.goal : goalFilter)
    );
  };

  const pickMealItems = (mealName, count = 2, offset = 0) => {
    const pool = getMealPool(mealName);
    const result = [];
    for (let i = 0; i < count && i < pool.length; i++) {
      result.push(pool[(offset + i) % pool.length]);
    }
    return result;
  };

  const getAlternatives = (mealItem, mealName) => {
    if (!mealItem) return [];
    return getMealPool(mealName)
      .filter((item) => item.Food_Item !== mealItem.Food_Item)
      .slice(0, 2);
  };

  const generateDailyDiet = () => {
    setDailyDiet({
      breakfast: pickMealItems("Breakfast", 2, 0),
      lunch: pickMealItems("Lunch", 2, 1),
      snack: pickMealItems("Snack", 2, 2),
      dinner: pickMealItems("Dinner", 2, 3),
    });
  };

  const replaceMeal = (mealName, offset) => {
    setDailyDiet((prev) => ({
      ...prev,
      [mealName]: pickMealItems(
        mealName.charAt(0).toUpperCase() + mealName.slice(1),
        2,
        offset
      ),
    }));
  };

  const generateWeeklyDiet = () => {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    const week = days.map((day, index) => {
      const breakfast = pickMealItems("Breakfast", 2, index);
      const lunch = pickMealItems("Lunch", 2, index + 1);
      const snack = pickMealItems("Snack", 2, index + 2);
      const dinner = pickMealItems("Dinner", 2, index + 3);

      return {
        day,
        breakfast,
        lunch,
        snack,
        dinner,
      };
    });

    setWeeklyDiet(week);
  };

  const totalDailyCalories =
    (dailyDiet.breakfast || []).reduce((sum, item) => sum + (Number(item.Calories_per_100g) || 0), 0) +
    (dailyDiet.lunch || []).reduce((sum, item) => sum + (Number(item.Calories_per_100g) || 0), 0) +
    (dailyDiet.snack || []).reduce((sum, item) => sum + (Number(item.Calories_per_100g) || 0), 0) +
    (dailyDiet.dinner || []).reduce((sum, item) => sum + (Number(item.Calories_per_100g) || 0), 0);

  const recommendedFoods = useMemo(() => {
    if (!user) return foods.slice(0, 8);

    return [...foods]
      .filter((item) => {
        const goalMatch = !user.goal || item.Goal === user.goal;
        const dietMatch =
          !user.diet_type ||
          user.diet_type === "Both" ||
          item.Diet_Type === user.diet_type;
        return goalMatch && dietMatch;
      })
      .sort((a, b) => scoreFood(b, user.goal) - scoreFood(a, user.goal))
      .slice(0, 8);
  }, [foods, user]);

  const saveDietPlan = async (planType, content) => {
    if (!userId) return;

    const res = await fetch("http://127.0.0.1:5000/save-plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        plan_type: planType,
        content,
      }),
    });

    const data = await res.json();
    alert(data.message);
    await fetchSavedPlans(userId);
  };

  const saveProgress = async () => {
    if (!userId || !progressWeight) return;

    const res = await fetch("http://127.0.0.1:5000/save-progress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        weight: progressWeight,
        recorded_at: new Date().toISOString().split("T")[0],
      }),
    });

    const data = await res.json();
    alert(data.message);
    setProgressWeight("");
    await fetchProgress(userId);
  };

  const askChatbot = async () => {
    if (!chatMessage.trim()) return;

    const res = await fetch("http://127.0.0.1:5000/chatbot", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: chatMessage }),
    });

    const data = await res.json();
    setChatReply(data.reply || "");
  };

  if (page === "auth") {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <h1>FitFuel</h1>

          <h2>Signup</h2>
          <input
            type="text"
            placeholder="Username"
            value={signupData.username}
            onChange={(e) =>
              setSignupData({ ...signupData, username: e.target.value })
            }
          />
          <input
            type="password"
            placeholder="Password"
            value={signupData.password}
            onChange={(e) =>
              setSignupData({ ...signupData, password: e.target.value })
            }
          />
          <button onClick={handleSignup}>Signup</button>

          <h2>Login</h2>
          <input
            type="text"
            placeholder="Username"
            value={loginData.username}
            onChange={(e) =>
              setLoginData({ ...loginData, username: e.target.value })
            }
          />
          <input
            type="password"
            placeholder="Password"
            value={loginData.password}
            onChange={(e) =>
              setLoginData({ ...loginData, password: e.target.value })
            }
          />
          <button onClick={handleLogin}>Login</button>
        </div>
      </div>
    );
  }

  if (page === "profile") {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <h1>Profile Setup</h1>

          <input
            type="number"
            placeholder="Age"
            value={profile.age}
            onChange={(e) => setProfile({ ...profile, age: e.target.value })}
          />

          <input
            type="text"
            placeholder="Gender"
            value={profile.gender}
            onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
          />

          <input
            type="number"
            placeholder="Weight (kg)"
            value={profile.weight}
            onChange={(e) => setProfile({ ...profile, weight: e.target.value })}
          />

          <input
            type="number"
            placeholder="Height (cm)"
            value={profile.height}
            onChange={(e) => setProfile({ ...profile, height: e.target.value })}
          />

          <select
            value={profile.goal}
            onChange={(e) => setProfile({ ...profile, goal: e.target.value })}
          >
            <option value="">Select Goal</option>
            <option value="Weight Loss">Weight Loss</option>
            <option value="Weight Gain">Weight Gain</option>
            <option value="Muscle Gain">Muscle Gain</option>
          </select>

          <select
            value={profile.diet_type}
            onChange={(e) =>
              setProfile({ ...profile, diet_type: e.target.value })
            }
          >
            <option value="">Select Diet Type</option>
            <option value="Veg">Veg</option>
            <option value="Non-Veg">Non-Veg</option>
            <option value="Eggetarian">Eggetarian</option>
            <option value="Both">Veg + Non-Veg</option>
          </select>

          <button onClick={handleProfileSave}>Save Profile</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>🔥 FitFuel Dashboard</h1>

      {user && (
        <div className="profile-box">
          <h2>Welcome, {user.username}</h2>
          <p>Age: {user.age}</p>
          <p>Gender: {user.gender}</p>
          <p>Weight: {user.weight} kg</p>
          <p>Height: {user.height} cm</p>
          <p>Goal: {user.goal}</p>
          <p>Diet Type: {user.diet_type}</p>
          <p>BMI: <strong>{bmi}</strong> | Status: <strong>{bmiStatus}</strong></p>
          <p>Daily Calorie Target: <strong>{calorieTarget}</strong></p>
          <button onClick={() => setPage("profile")}>Edit Profile</button>
        </div>
      )}

      <div className="planner-box">
        <h2>Recommended Foods For You</h2>
        <div className="food-grid">
          {(recommendedFoods || []).map((item, index) => {
            const qty = getQuantity(item, user?.goal, item.Meal_Time || "Meal");
            return (
              <div className="card" key={index}>
                <img src={getFoodImage(item)} alt={item.Food_Item} className="food-image" />
                <h3>{item.Food_Item}</h3>
                <p>Calories: {item.Calories_per_100g}</p>
                <p>Protein: {item.Protein_g}g</p>
                <p>Meal Time: {item.Meal_Time}</p>
                <p>Goal: {item.Goal}</p>
                <p>Quantity: {qty.grams}g</p>
                <p>Benefit: {getBenefits(item)}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="planner-box">
        <h2>Daily Diet</h2>
        <button onClick={generateDailyDiet}>Generate Daily Diet</button>
        <button onClick={() => saveDietPlan("daily", dailyDiet)}>Save Daily Plan</button>

        {totalDailyCalories > 0 && (
          <p className="total-calories">
            Total Daily Calories: <strong>{totalDailyCalories}</strong>
          </p>
        )}

        <div className="daily-grid">
          {[
            ["breakfast", "Breakfast"],
            ["lunch", "Lunch"],
            ["snack", "Snack"],
            ["dinner", "Dinner"],
          ].map(([mealKey, label], index) => (
            <div className="card" key={mealKey}>
              <h3>{label} - {mealTimings[mealKey]}</h3>
              {(dailyDiet[mealKey] || []).map((meal, i) => {
                const qty = getQuantity(meal, user?.goal, label);
                return (
                  <div key={i} className="meal-item">
                    <img src={getFoodImage(meal)} alt={meal.Food_Item} className="food-image" />
                    <p><strong>{meal.Food_Item}</strong></p>
                    <p>Calories: {meal.Calories_per_100g}</p>
                    <p>Protein: {meal.Protein_g}g</p>
                    <p>Quantity: {qty.grams}g</p>
                    <p>Intake: {qty.note}</p>
                    <p>Benefit: {getBenefits(meal)}</p>
                    <p>
                      Alternatives:{" "}
                      {getAlternatives(meal, label)
                        .map((a) => a.Food_Item)
                        .join(", ") || "No alternative available"}
                    </p>
                  </div>
                );
              })}
              <button onClick={() => replaceMeal(mealKey, index + 5)}>
                Replace {label}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="top-bar">
        <input
          placeholder="Search food..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select value={mealFilter} onChange={(e) => setMealFilter(e.target.value)}>
          <option value="All">All Meals</option>
          <option value="Breakfast">Breakfast</option>
          <option value="Lunch">Lunch</option>
          <option value="Snack">Snack</option>
          <option value="Dinner">Dinner</option>
        </select>

        <select value={goalFilter} onChange={(e) => setGoalFilter(e.target.value)}>
          <option value="All">All Goals</option>
          <option value="Weight Loss">Weight Loss</option>
          <option value="Weight Gain">Weight Gain</option>
          <option value="Muscle Gain">Muscle Gain</option>
        </select>

        <select value={dietFilter} onChange={(e) => setDietFilter(e.target.value)}>
          <option value="All">All Diet Types</option>
          <option value="Veg">Veg</option>
          <option value="Non-Veg">Non-Veg</option>
          <option value="Eggetarian">Eggetarian</option>
          <option value="Both">Veg + Non-Veg</option>
        </select>

        <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
          {uniqueRegions.map((r, i) => (
            <option key={i} value={r}>{r}</option>
          ))}
        </select>
      </div>

      <div className="planner-box">
        <h2>Weekly Diet</h2>
        <button onClick={generateWeeklyDiet}>Generate Weekly Diet</button>
        <button onClick={() => saveDietPlan("weekly", weeklyDiet)}>Save Weekly Plan</button>

        <div className="weekly-grid">
          {(weeklyDiet || []).map((day, i) => (
            <div className="card" key={i}>
              <h3>{day.day}</h3>
              {day.breakfast?.[0] && (
                <img src={getFoodImage(day.breakfast[0])} alt={day.breakfast[0].Food_Item} className="food-image" />
              )}
              <p><strong>Breakfast:</strong> {(day.breakfast || []).map((m) => `${m.Food_Item} (${getQuantity(m, user?.goal, "Breakfast").grams}g)`).join(", ")}</p>
              <p><strong>Lunch:</strong> {(day.lunch || []).map((m) => `${m.Food_Item} (${getQuantity(m, user?.goal, "Lunch").grams}g)`).join(", ")}</p>
              <p><strong>Snack:</strong> {(day.snack || []).map((m) => `${m.Food_Item} (${getQuantity(m, user?.goal, "Snack").grams}g)`).join(", ")}</p>
              <p><strong>Dinner:</strong> {(day.dinner || []).map((m) => `${m.Food_Item} (${getQuantity(m, user?.goal, "Dinner").grams}g)`).join(", ")}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="planner-box">
        <h2>Progress Tracker</h2>
        <input
          type="number"
          placeholder="Enter current weight"
          value={progressWeight}
          onChange={(e) => setProgressWeight(e.target.value)}
        />
        <button onClick={saveProgress}>Save Progress</button>

        <div className="food-grid">
          {(progressList || []).map((item) => (
            <div className="card" key={item.id}>
              <p><strong>Weight:</strong> {item.weight} kg</p>
              <p><strong>Date:</strong> {item.recorded_at}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="planner-box">
        <h2>Chatbot For Diet Suggestions</h2>
        <input
          type="text"
          placeholder="Ask something about diet..."
          value={chatMessage}
          onChange={(e) => setChatMessage(e.target.value)}
        />
        <button onClick={askChatbot}>Ask</button>
        {chatReply && <p className="chat-reply">{chatReply}</p>}
      </div>

      <div className="planner-box">
        <h2>Saved Plans</h2>
        <div className="food-grid">
          {(savedPlans || []).map((plan) => (
            <div className="card" key={plan.id}>
              <p><strong>Type:</strong> {plan.plan_type}</p>
              <p><strong>Saved At:</strong> {plan.created_at}</p>

              {plan.plan_type === "daily" && plan.content && (
                <div>
                  <p><strong>Breakfast:</strong> {(plan.content.breakfast || []).map((m) => m.Food_Item).join(", ")}</p>
                  <p><strong>Lunch:</strong> {(plan.content.lunch || []).map((m) => m.Food_Item).join(", ")}</p>
                  <p><strong>Snack:</strong> {(plan.content.snack || []).map((m) => m.Food_Item).join(", ")}</p>
                  <p><strong>Dinner:</strong> {(plan.content.dinner || []).map((m) => m.Food_Item).join(", ")}</p>
                </div>
              )}

              {plan.plan_type === "weekly" && Array.isArray(plan.content) && (
                <div>
                  {plan.content.slice(0, 3).map((day, idx) => (
                    <p key={idx}>
                      <strong>{day.day}:</strong> {(day.breakfast || []).map((m) => m.Food_Item).join(", ")}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <h2 className="section-title">Food Database</h2>
      <p className="items-count">Total Items Showing: {filteredFoods.length}</p>

      <div className="food-grid">
        {(filteredFoods || []).map((f, i) => {
          const qty = getQuantity(
            f,
            goalFilter === "All" ? user?.goal : goalFilter,
            f.Meal_Time || "Meal"
          );

          return (
            <div key={i} className="card">
              <img src={getFoodImage(f)} alt={f.Food_Item} className="food-image" />
              <h3>{f.Food_Item}</h3>
              <p>Calories: {f.Calories_per_100g}</p>
              <p>Protein: {f.Protein_g}g</p>
              <p>Carbs: {f.Carbs_g}g</p>
              <p>Fat: {f.Fat_g}g</p>
              <p>Fiber: {f.Fiber_g}g</p>
              <p>Meal: {f.Meal_Time}</p>
              <p>Diet: {f.Diet_Type}</p>
              <p>Goal: {f.Goal}</p>
              <p>Region: {f.Region}</p>
              <p>Suggested Quantity: {qty.grams}g</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}