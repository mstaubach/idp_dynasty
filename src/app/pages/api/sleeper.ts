const fetchTeams = async () => {
  try {
    const response = await fetch(
      "https://api.sleeper.app/v1/league/1048426134855081984/rosters"
    );
    const teamData = await response.json();
    console.log(teamData);
    return teamData;
  } catch (error) {
    console.log(error);
  }
};

export default fetchTeams;
