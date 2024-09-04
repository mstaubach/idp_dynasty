export default async function Home() {
  const response = await fetch(
    "https://api.sleeper.app/v1/league/1048426134855081984/rosters"
  );
  let teams = await response.json();

  return (
    <main>
      <h1>IDP</h1>
      <ul>
        {teams.map((team: any) => (
          <li key={team.id}>{team.owner_id}</li>
        ))}
      </ul>
    </main>
  );
}
