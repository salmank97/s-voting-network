/* eslint-disable require-jsdoc */
'use strict';

const AdminConnection = require('composer-admin').AdminConnection;
const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const {BusinessNetworkDefinition, CertificateUtil, IdCard} = require('composer-common');
const path = require('path');

require('chai').should();

const namespace = 'one.xord.svoting';

const societyClass = 'Society';
const electionClass = 'Election';
const candidateClass = 'Candidate';
const voterClass = 'Voter';
const voteClass = 'Vote';
const castVoteTransaction = 'CastVote';

const societyPrefix = 's-';
const electionPrefix = 'e-';
const candidatePrefix = 'c-';
const voterPrefix = 'v-';
const votePrefix = 'vt-';

var society, election, candidate1, candidate2, voter1, voter2, voter3, vote1, vote2, vote3;

describe('Cast Vote', () => {
    // In-memory card store for testing so cards are not persisted to the file system
    const cardStore = require('composer-common').NetworkCardStoreManager.getCardStore({type: 'composer-wallet-inmemory'});
    let adminConnection;
    let businessNetworkConnection;

    before(async () => {
        // Embedded connection used for local testing
        const connectionProfile = {
            name: 'embedded',
            'x-type': 'embedded'
        };
        // Generate certificates for use with the embedded connection
        const credentials = CertificateUtil.generate({commonName: 'admin'});

        // PeerAdmin identity used with the admin connection to deploy business networks
        const deployerMetadata = {
            version: 1,
            userName: 'PeerAdmin',
            roles: ['PeerAdmin', 'ChannelAdmin']
        };
        const deployerCard = new IdCard(deployerMetadata, connectionProfile);
        deployerCard.setCredentials(credentials);

        const deployerCardName = 'PeerAdmin';
        adminConnection = new AdminConnection({cardStore: cardStore});

        await adminConnection.importCard(deployerCardName, deployerCard);
        await adminConnection.connect(deployerCardName);

        businessNetworkConnection = new BusinessNetworkConnection({cardStore: cardStore});

        const adminUserName = 'admin';
        let adminCardName;
        let businessNetworkDefinition = await BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'));

        // Install the Composer runtime for the new business network
        await adminConnection.install(businessNetworkDefinition);

        // Start the business network and configure an network admin identity
        const startOptions = {
            networkAdmins: [
                {
                    userName: adminUserName,
                    enrollmentSecret: 'adminpw'
                }
            ]
        };
        const adminCards = await adminConnection.start(businessNetworkDefinition.getName(), businessNetworkDefinition.getVersion(), startOptions);

        // Import the network admin identity for us to use
        adminCardName = `${adminUserName}@${businessNetworkDefinition.getName()}`;
        await adminConnection.importCard(adminCardName, adminCards.get(adminUserName));

        // Connect to the business network using the network admin identity
        await businessNetworkConnection.connect(adminCardName);
    });

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    describe('#cast', () => {
        it('should be able to register a society', async () => {
            // Create factory
            const factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            // Create registry
            const societyRegistry = await businessNetworkConnection.getParticipantRegistry(namespace + '.' + societyClass);

            // Create society
            society = factory.newResource(namespace, societyClass, societyPrefix + generateUUID());
            society.name = societyClass;
            society.presidentId = 'p-' + generateUUID();

            // Add society to registry
            await societyRegistry.add(society);

            // Get a new instance and check
            society = await societyRegistry.get(society.id);
            society.name.should.equal(societyClass);
        });

        it('should be able to start election', async () => {
            // Create factory
            const factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            // Create registry
            const electionRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.' + electionClass);

            // Create election
            election = factory.newResource(namespace, electionClass, electionPrefix + generateUUID());
            election.prepareTime = Date.now();
            election.startTime = Date.now();
            election.endTime = Date.now() + 200000;
            election.position = 'President';
            election.societies = [factory.newRelationship(namespace, societyClass, society.$identifier)];

            // Add election to registry
            await electionRegistry.add(election);

            // Get a new instance and check
            election = await electionRegistry.get(election.id);
            election.position.should.equal('President');
        });

        it('should be able to register candidates', async () => {
            // Create factory
            const factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            // Create registry
            const candidateRegistry = await businessNetworkConnection.getParticipantRegistry(namespace + '.' + candidateClass);

            // Create candidates
            candidate1 = factory.newResource(namespace, candidateClass, candidatePrefix + generateUUID());
            candidate1.name = 'Candidate 1';
            candidate1.cgpa = 3.5;
            candidate1.semester = 8;
            candidate1.pastExperience = 'Past experience';
            candidate1.society = factory.newRelationship(namespace, societyClass, society.$identifier);
            candidate1.election = factory.newRelationship(namespace, electionClass, election.$identifier);

            candidate2 = factory.newResource(namespace, candidateClass, candidatePrefix + generateUUID());
            candidate2.name = 'Candidate 2';
            candidate2.cgpa = 3.7;
            candidate2.semester = 7;
            candidate2.pastExperience = 'Past experience';
            candidate2.society = factory.newRelationship(namespace, societyClass, society.$identifier);
            candidate2.election = factory.newRelationship(namespace, electionClass, election.$identifier);

            // Add all candidates to registry
            await candidateRegistry.addAll([candidate1, candidate2]);

            // Get new instances
            candidate1 = await candidateRegistry.get(candidate1.id);
            candidate2 = await candidateRegistry.get(candidate2.id);

            // Check new instances
            candidate1.name.should.equal('Candidate 1');
            candidate2.name.should.equal('Candidate 2');
        });

        it('should be able to register voters', async () => {
            // Create factory
            const factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            // Create registries
            const voterRegistry = await businessNetworkConnection.getParticipantRegistry(namespace + '.' + voterClass);
            const voteRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.' + voteClass);

            // Create voters
            voter1 = factory.newResource(namespace, voterClass, voterPrefix + generateUUID());
            voter1.name = 'Voter 1';
            voter2 = factory.newResource(namespace, voterClass, voterPrefix + generateUUID());
            voter2.name = 'Voter 2';
            voter3 = factory.newResource(namespace, voterClass, voterPrefix + generateUUID());
            voter3.name = 'Voter 3';

            // Add all voters to registry
            await voterRegistry.addAll([voter1, voter2, voter3]);

            // Create votes
            vote1 = factory.newResource(namespace, voteClass, votePrefix + generateUUID());
            vote2 = factory.newResource(namespace, voteClass, votePrefix + generateUUID());
            vote3 = factory.newResource(namespace, voteClass, votePrefix + generateUUID());

            // Assign votes
            vote1.owner = factory.newRelationship(namespace, voterClass, voter1.$identifier);
            vote2.owner = factory.newRelationship(namespace, voterClass, voter2.$identifier);
            vote3.owner = factory.newRelationship(namespace, voterClass, voter3.$identifier);

            // Add all votes to registry
            await voteRegistry.addAll([vote1, vote2, vote3]);

            // Get new instances of voters
            voter1 = await voterRegistry.get(voter1.id);
            voter2 = await voterRegistry.get(voter2.id);
            voter3 = await voterRegistry.get(voter3.id);

            // Get new instances of votes
            vote1 = await voteRegistry.get(vote1.id);
            vote2 = await voteRegistry.get(vote2.id);
            vote3 = await voteRegistry.get(vote3.id);

            // Check new instances of voters
            voter1.name.should.equal('Voter 1');
            voter2.name.should.equal('Voter 2');
            voter3.name.should.equal('Voter 3');
        });

        it('should be able to assign new votes', async () => {
            // Create factory
            const factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            // Create registries
            const voteRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.' + voteClass);

            // Create votes
            vote1 = factory.newResource(namespace, voteClass, votePrefix + generateUUID());
            vote2 = factory.newResource(namespace, voteClass, votePrefix + generateUUID());
            vote3 = factory.newResource(namespace, voteClass, votePrefix + generateUUID());

            // Assign votes
            vote1.owner = factory.newRelationship(namespace, voterClass, voter1.$identifier);
            vote2.owner = factory.newRelationship(namespace, voterClass, voter2.$identifier);
            vote3.owner = factory.newRelationship(namespace, voterClass, voter3.$identifier);

            // Add all votes to registry
            await voteRegistry.addAll([vote1, vote2, vote3]);

            // Get new instances of votes
            vote1 = await voteRegistry.get(vote1.id);
            vote2 = await voteRegistry.get(vote2.id);
            vote3 = await voteRegistry.get(vote3.id);

            // Check new instances of voters
            vote1.owner.$identifier.should.equal(voter1.$identifier);
            vote2.owner.$identifier.should.equal(voter2.$identifier);
            vote3.owner.$identifier.should.equal(voter3.$identifier);
        });

        it('should be able to cast votes', async () => {
            // Create factory
            const factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            // Create registry
            const voteRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.' + voteClass);

            // Create castVote1 transaction for voter1
            const castVote1 = factory.newTransaction(namespace, castVoteTransaction);
            castVote1.voteId = vote1.id;
            castVote1.voterId = voter1.id;
            castVote1.candidateId = candidate1.id;
            castVote1.electionId = election.id;

            // Submit transaction castVote1
            await businessNetworkConnection.submitTransaction(castVote1);

            // Create castVote2 transaction for voter2
            const castVote2 = factory.newTransaction(namespace, castVoteTransaction);
            castVote2.voteId = vote2.id;
            castVote2.voterId = voter2.id;
            castVote2.candidateId = candidate1.id;
            castVote2.electionId = election.id;

            // Submit transaction castVote2
            await businessNetworkConnection.submitTransaction(castVote2);

            // Create castVote3 transaction for voter3
            const castVote3 = factory.newTransaction(namespace, castVoteTransaction);
            castVote3.voteId = vote3.id;
            castVote3.voterId = voter3.id;
            castVote3.candidateId = candidate2.id;
            castVote3.electionId = election.id;

            // Submit transaction castVote3
            await businessNetworkConnection.submitTransaction(castVote3);

            // Get the result of votes
            vote1 = await voteRegistry.get(vote1.id);
            vote2 = await voteRegistry.get(vote2.id);
            vote3 = await voteRegistry.get(vote3.id);

            // Check vote owners
            vote1.owner.$identifier.should.equal(candidate1.$identifier);
            vote2.owner.$identifier.should.equal(candidate1.$identifier);
            vote3.owner.$identifier.should.equal(candidate2.$identifier);
        });
    });
});