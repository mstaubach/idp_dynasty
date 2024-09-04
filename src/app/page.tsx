export default async function Home() {
  const response = await fetch(
    "https://api.sleeper.app/v1/league/1048426134855081984/rosters"
  );
  let teams = await response.json();

  console.log(teams);

  return (
    <main>
      <h1>IDP</h1>
      <div>
        <table className="border-collapse border border-white py-10">
          <thead>
            <tr>
              <th className="border border-white p-4">Name</th>
              <th className="border border-white p-4">Wins</th>
              <th className="border border-white p-4">Losses</th>
              <th className="border border-white p-4">Ties (Ew)</th>
            </tr>
          </thead>
          {teams.map((team: any) => (
            <tbody key="">
              <td className="border border-white p-4">{team.roster_id}</td>
              <td className="border border-white p-4">{team.settings.wins}</td>
              <td className="border border-white p-4">
                {team.settings.losses}
              </td>
              <td className="border border-white p-4">{team.settings.ties}</td>
            </tbody>
          ))}
        </table>
      </div>
    </main>
  );
}
