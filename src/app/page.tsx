import StandingsTable from "./(components)/StandingsTable";
import FirstPlaceFinish from "./(components)/FirstPlaceFinish";

export default async function Home() {
  return (
    <main className="flex justify-between">
      <div className="p-10">
        <h1 className="p-5 font-bold">IDP League Home Page</h1>
        <p>
          The IDP Dynasty league originally began as a keeper league that
          eventually transformed into a dynasty league. The individual defensive
          format has the teams start 19 total players - offense and defense
          combined.
        </p>
      </div>
      <div className="p-10">
        <FirstPlaceFinish />
        <StandingsTable />
      </div>
    </main>
  );
}
