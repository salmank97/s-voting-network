/* eslint-disable require-jsdoc */
'use strict';

const namespace = 'one.xord.svoting';

/**
 * Give a vote to candidate and change voter status to voted
 * @param {one.xord.svoting.CastVote} tx - the vote to be processed
 * @transaction
 */
async function vote(tx) {
    let electionRegistry = await getAssetRegistry(namespace + '.Election');
    let voteRegistry = await getAssetRegistry(namespace + '.Vote');
    let voterRegistry = await getParticipantRegistry(namespace + '.Voter');
    let candidateRegistry = await getParticipantRegistry(namespace + '.Candidate');

    let factory = getFactory();
    let voteEvent = factory.newEvent(namespace, 'VoteEvent');

    try {
        let election = await electionRegistry.get(tx.electionId);
        let currentTime = Date.now();

        if (currentTime >= election.startTime && currentTime <= election.endTime) {
            let vote = await voteRegistry.get(tx.voteId);
            let voter = await voterRegistry.get(tx.voterId);

            if (!voter.hasVoted && vote.owner === voter) {
                voteEvent.status = 'Failure';
                voteEvent.message = 'Voter has already voted';
                emit(voteEvent);
            } else {
                let candidate = await candidateRegistry.get(tx.candidateId);

                voter.hasVoted = true;
                vote.owner = candidate;
                candidate.votes++;

                await voteRegistry.update(vote);
                await voterRegistry.update(voter);
                await candidateRegistry.update(candidate);

                voteEvent.status = 'Success';
                voteEvent.message = 'Voted successfully';
                emit(voteEvent);
            }
        } else {
            voteEvent.status = 'Failure';
            voteEvent.message = 'Election time ran out or has not started yet';
            emit(voteEvent);
        }
    } catch (error) {
        console.error(error);
        voteEvent.status = 'Failure';
        voteEvent.message = 'Invalid values';
        emit(voteEvent);
    }
}