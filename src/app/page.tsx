import StandingsTable from "./(components)/StandingsTable";

export default async function Home() {
  return (
    <main>
      <h1>IDP League Home Page</h1>

      <p>
        The IDP Dynasty league originally began as a keeper league that
        eventually transformed into a dynasty league. The individual defensive
        format has the teams start 19 total players - offense and defense
        combined.
      </p>

      <StandingsTable />
    </main>
  );
}
