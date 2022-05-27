import { Contract, providers } from "ethers";
import { formatEther } from "ethers/lib/utils";
import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import Web3Modal from "web3modal";
import {
  CRYPTODEVS_DAO_ABI,
  CRYPTODEVS_DAO_CONTRACT_ADDRESS,
  CRYPTODEVS_NFT_ABI,
  CRYPTODEVS_NFT_CONTRACT_ADDRESS,
} from "../constants";
import styles from "../styles/Home.module.css";

export default function Home() {
  //ETH balance of the DAO contract
  const [treasuryBalance, setTreasuryBalance] = useState("0");
  //number of proposals created in the DAO
  const [numProposals, setNumProposals] = useState("0");
  //array of all proposals created in the DAO
  const [proposals, setProposals] = useState([]);
  //user's balance of CryptoDevs NFTs
  const [nftBalance, setNftBalance] = useState(0);
  //fake NFT Token ID to purchase. Used when creating a proposal
  const [fakeNftTokenId, setFakeNftTokenId] = useState("");
  //one of 'Create Proposal' or 'View Proposals'
  const [selectedTab, setSelectedTab] = useState("");
  //loading is true if we are waiting for a transaction to be mined, false otherwise
  const [loading, setLoading] = useState(false);
  //walletConnected is true if the user has connected their wallet, false otherwise
  const [walletConnected, setWalletConnected] = useState(false);
  const web3ModalRef = useRef();

  //connectWallet is a helper function to connect a wallet
  const connectWallet = async () => {
    try {
      await getProviderOrSigner();
      setWalletConnected(true);
    } catch (error) {
      console.error(error);
    }
  };

  // Reads the ETH balance of the DAO contract and sets the `treasuryBalance` state variable
  const getDAOTreasuryBalance = async () => {
    try {
      const provider = await getProviderOrSigner();
      const balance = await provider.getBalance(
        CRYPTODEVS_DAO_CONTRACT_ADDRESS
      );
      setTreasuryBalance(balance.toString());
    } catch (error) {
      console.error(error);
    }
  };

  //getNumProposalsInDAO reads the number of proposals in the DAO contract
  //and sets the 'numProposals' state variable
  const getNumProposalsInDAO = async () => {
    try {
      const provider = await getProviderOrSigner();
      const contract = getDaoContractInstance(provider);
      const daoNumProposals = await contract.numProposals();
      setNumProposals(daoNumProposals.toString());
    } catch (error) {
      console.error(error);
    }
  };

  //getUserNFTBalance reads the balance of the user's CryptoDevs NFTs and sets the 'nftBalance' state variable
  const getUserNFTBalance = async () => {
    try {
      const signer = await getProviderOrSigner(true);
      const nftContract = getCryptodevsNFTContractInstance(signer);
      const balance = await nftContract.balanceOf(signer.getAddress());
      setNftBalance(parseInt(balance.toString()));
    } catch (error) {
      console.error(error);
    }
  };

  //createProposal calls the 'createProposal' function in the contract, using the tokenId from 'fakeNftTokenId'
  const createProposal = async () => {
    try {
      const signer = await getProviderOrSigner(true);
      const daoContract = getDaoContractInstance(signer);
      const txn = await daoContract.createProposal(fakeNftTokenId);
      setLoading(true);
      await txn.wait();
      await getNumProposalsInDAO();
      setLoading(false);
    } catch (error) {
      console.error(error);
      window.alert(error.data.message);
    }
  };

  /*
  fetchProposalById is a helper function to fetch and parse one proposal from the DAO
  contract given the Proposal ID, and converts the returned data into a JS object with values we can use
  */
  const fetchProposalById = async (id) => {
    try {
      const provider = await getProviderOrSigner();
      const daoContract = getDaoContractInstance(provider);
      const proposal = await daoContract.proposals(id);
      const parsedProposal = {
        proposalId: id,
        nftTokenId: proposal.nftTokenId.toString(),
        deadline: new Date(parseInt(proposal.deadline.toString())*1000),
        yayVotes: proposal.yayVotes.toString(),
        nayVotes: proposal.nayVotes.toString(),
        executed: proposal.executed,
      };
      return parsedProposal;
    } catch (error) {
      console.error(error);
    }
  };

  //fetchAllProposals runs a loop 'numProposals' times to fetch all proposals in the DAO
  //and sets the 'proposals' state variable
  const fetchAllProposals = async () => {
    try {
      const proposals = [];
      for (let i = 0; i < numProposals; i++) {
        const proposal = await fetchProposalById(i);
        proposals.push(proposal);
      }
      setProposals(proposals);
      return proposals;
    } catch (error) {
      console.error(error);
    }
  };

  //calls the 'voteOnProposal' function in the contract, using the proposal ID and the vote
  const voteOnProposal = async (proposalId, _vote) => {
    try {
      const signer = await getProviderOrSigner(true);
      const daoContract = getDaoContractInstance(signer);
      let vote = _vote ==="YAY" ? 0 : 1;
      const txn = await daoContract.voteOnProposal(proposalId, vote);
      setLoading(true);
      await txn.wait();
      setLoading(false);
      await fetchAllProposals();
    } catch (error) {
      console.error(error);
      window.alert(error.data.message);
    }
  };

  //calls the 'executeProposal' function in the contract, using the proposal ID
  const executeProposal = async (proposalId) => {
    try {
      const signer = await getProviderOrSigner(true);
      const daoContract = getDaoContractInstance(signer);
      const txn = await daoContract.executeProposal(proposalId);
      setLoading(true);
      await txn.wait();
      setLoading(false);
      await fetchAllProposals();
    } catch (error) {
      console.error(error);
      window.alert(error.data.message);
    }
  };

  //getProviderOrSigner is a helper function to get the provider or signer from the wallet
  const getProviderOrSigner = async (needSigner = false) => {
    const provider = await web3ModalRef.current.connect();
    const web3Provider = new providers.Web3Provider(provider);
    
    const { chainId } = await web3Provider.getNetwork();
    if (chainId !== 4) {
      window.alert("Por favor conecte su wallet a la red Rinkeby");
      throw new Error("Por favor conecte su wallet a la red Rinkeby");
    }

    if (needSigner) {
      const signer = await web3Provider.getSigner();
      return signer;
    }
    return web3Provider;
  };

  //getDaoContractInstance is a helper function to get the DAO contract instance given a Provider/Signer
  const getDaoContractInstance = (providerOrSigner) => {
    return new Contract(
      CRYPTODEVS_DAO_CONTRACT_ADDRESS,
      CRYPTODEVS_DAO_ABI,
      providerOrSigner
    );
  };

  //getCryptodevsNFTContractInstance is a helper function to return a CryptoDevs NFT contract instance
  //given a Provider/Signer
  const getCryptodevsNFTContractInstance = (providerOrSigner) => {
    return new Contract(
      CRYPTODEVS_NFT_CONTRACT_ADDRESS,
      CRYPTODEVS_NFT_ABI,
      providerOrSigner
    );
  };

  /*
  This is a piece of code that runs every time the value of 'walletConnected' changes.
  So when a wallet connects or disconnects prompts the user to connect a wallet if it not already connected
  and then calls a helper function to fetch the DAO Treasury balance, user NFT balance, and number of proposals in the DAO
  */
  useEffect(() => {
    if (!walletConnected) {
      web3ModalRef.current = new Web3Modal({
        network: "rinkeby",
        providerOptions: {},
        disableInjectedProvider: false,
      });
      connectWallet().then(() => {
        getDAOTreasuryBalance();
        getUserNFTBalance();
        getNumProposalsInDAO();
      });
    }
  }, [walletConnected]);

  /*
  Piece of code that runs every time the value of 'selectedTab' changes.
  Used to re-fetch all proposals in the DAO when user switches to the 'View Proposals' tab
  */
  useEffect(() => {
    if (selectedTab === "View Proposals") {
      fetchAllProposals();
    }
  }, [selectedTab]);

  //render the contents of the appropriate tab based on 'selectedTab'
  function renderTabs() {
    if (selectedTab === "Create Proposal") {
      return renderCreateProposalTab();
    } else if (selectedTab === "View Proposals") {
      return renderViewProposalsTab();
    }
    return null;
  }
  
  //renders the 'create proposal' tab content
  function renderCreateProposalTab() {
    if (loading) {
      return (
        <div className={styles.description}>
          Cargando... Esperando a que se finalice la transacción
        </div>
      );
    } else if (nftBalance === 0) {
      return (
        <div className={styles.description}>
          No posee ningún CryptoDevs NFT. <br />
          <b>No puedes crear o votar propuestas</b>
        </div>
      );
    } else {
      return (
        <div className={styles.container}>
          <label>Fake NFT Token ID a comprar: </label>
          <input placeholder="0" type="number" onChange={(e) => setFakeNftTokenId(e.target.value)} />
          <button className={styles.button2} onClick={createProposal}>Crear propuesta</button>
        </div>
      );
    }
  }

  //renders the 'view proposals' tab content
  function renderViewProposalsTab() {
    if (loading) {
      return (
        <div className={styles.description}>
          Cargando... Esperando a que se finalice la transacción
        </div>
      );
    } else if (proposals.length === 0) {
      return (
        <div className={styles.description}>
          No hay propuestas creadas en la DAO.
        </div>
      );
    } else {
      return (
        <div>
          {proposals.map((p, index) => (
            <div key={index} className={styles.proposalCard}>
              <p>ID de la propuesta: {p.proposalId}</p>
              <p>Fake NFT a comprar: {p.nftTokenId}</p>
              <p>Fin del plazo: {p.deadline.toLocaleString()}</p>
              <p>Votos positivos: {p.yayVotes}</p>
              <p>Votos negativos: {p.nayVotes}</p>
              <p>Propuesta ejecutada?: {p.executed.toString()}</p>
              {p.deadline.getTime() > Date.now() && !p.executed ? (
                <div className={styles.flex}>
                  <button className={styles.button2} onClick={() => voteOnProposal(p.proposalId, "YAY")}>Votar a favor</button>
                  <button className={styles.button2} onClick={() => voteOnProposal(p.proposalId, "NAY")}>Votar en contra</button>
                </div>
              ): p.deadline.getTime() < Date.now() && !p.executed ? (
                <div className={styles.flex}>
                  <button className={styles.button2} onClick={() => executeProposal(p.proposalId)}>Ejecutar propuesta{" "}
                    {p.yayVotes > p.nayVotes ? "(YAY)" : "(NAY)"}</button>
                </div>
              ) : (
                <div className={styles.description}>Propuesta Ejecutada</div>
              )}
            </div>
          ))}
        </div>
      );
    }
  }
  return (
    <div>
      <Head>
        <title>CryptoDevs DAO</title>
        <meta name="description" content="CryptoDevs DAO"/>
        <link rel="icon" href="/favicon.ico"/>
      </Head>

      <div className={styles.main}>
        <div>
          <h1 className={styles.title}>Bienvenid@s a Crypto Devs!</h1>
          <div className={styles.description}>Bienvenid@ a la DAO</div>
          <div className={styles.description}>
            Tu balance de CryptoDevs NFT es: {nftBalance}
            <br />
            Balance de tesorería: {formatEther(treasuryBalance)} ETH
            <br />
            Número total de propuestas en la DAO: {numProposals}
          </div>
          <div className={styles.flex}>
            <button className={styles.button} onClick={() => setSelectedTab("Create Proposal")}>
              Crear propuesta
            </button>
            <button className={styles.button} onClick={() => setSelectedTab("View Proposals")}>Ver Propuestas</button>
          </div>
          {renderTabs()}
        </div>
        <div>
          <img className={styles.image} src="/cryptodevs/0.svg"/>
        </div>
      </div>

      <footer className={styles.footer}>Made with &#10084; by Martin Iglesias</footer>
    </div>
  );
}