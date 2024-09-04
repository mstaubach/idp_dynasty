import Link from "next/link";
import Image from "next/image";

const NavBar = () => {
  let height = 25;
  let width = 25;
  return (
    <nav className="border-b-4 border-white p-2.5">
      <div className="flex justify-center p-5">
        <h1 className="font-extrabold text-3xl">IDP Dynasty</h1>
      </div>
      <div className="flex justify-center px-5">
        <div className="px-10 flex justify-center">
          <Image sr="" height={height} width={width} alt="Home Button." />
          <Link href="/">Home</Link>
        </div>
        <div className="px-10 flex justify-center">
          <Image sr="" height={height} width={width} alt="Matchups Section." />
          <Link href="/">Matchups</Link>
        </div>
        <div className="px-10 flex justify-center">
          <Image
            sr=""
            height={height}
            width={width}
            alt="Transactions Section."
          />
          <Link href="/">Transactions</Link>
        </div>
        <div className="px-10 flex justify-center">
          <Image sr="" height={height} width={width} alt="Rosters Section." />
          <Link href="/">Rosters</Link>
        </div>
        <div className="px-10 flex justify-center">
          <Image sr="" height={height} width={width} alt="Standings Section." />
          <Link href="/">Standings</Link>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
