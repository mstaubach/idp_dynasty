import { STATIC_STATUS_PAGE_GET_INITIAL_PROPS_ERROR } from "next/dist/lib/constants";
import { requestFormReset } from "react-dom";

export default async function StandingsTable() {
  const response = await fetch(
    "https://api.sleeper.app/v1/league/1048426134855081984/rosters"
  );
  let teams = await response.json();

  //Sorting wins from highest to lowest
  teams.sort(
    (a, b) => parseFloat(a.settings.wins) - parseFloat(b.settings.wiins)
  );

  return (
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
        {teams.map((team) => (
          <tbody key="">
            <tr>
              <td className="border border-white p-4">{team.roster_id}</td>
              <td className="border border-white p-4">{team.settings.wins}</td>
              <td className="border border-white p-4">
                {team.settings.losses}
              </td>
              <td className="border border-white p-4">{team.settings.ties}</td>
            </tr>
          </tbody>
        ))}
      </table>
    </div>
  );
}
