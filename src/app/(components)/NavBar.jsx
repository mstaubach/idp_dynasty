import Link from "next/link";
import Image from "next/image";

const NavBar = () => {
  return (
    <nav className="flex justify-between border-b-4 border-white p-2.5">
      <div className="flex justify-start px-10">
        <a href="/">
          <Image src="" width={50} height={50} alt="Home Page" />
        </a>
      </div>
      <div className="flex justify-center">
        <h1 className="bold-text text-3xl">IDP Dynasty</h1>
      </div>
    </nav>
  );
};

export default NavBar;
