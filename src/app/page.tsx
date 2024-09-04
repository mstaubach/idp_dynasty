import StandingsTable from "./(components)/StandingsTable";

export default async function Home() {
  return (
    <main>
      <h1>IDP League Home Page</h1>
      <div>
        <p>About the league here.</p>
      </div>
      <StandingsTable />
    </main>
  );
}
