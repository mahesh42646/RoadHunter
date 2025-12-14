'use client';

import { useState } from 'react';

// Dummy JSON data
const peopleData = [
    {
        id: 1,
        name: "John Doe",
        age: 28,
        email: "john.doe@example.com",
        city: "New York",
        bio: "Software developer passionate about gaming and technology.",
        avatar: "👨‍💻",
        friends: [2, 3, 4]
    },
    {
        id: 2,
        name: "Jane Smith",
        age: 25,
        email: "jane.smith@example.com",
        city: "Los Angeles",
        bio: "Gaming enthusiast and streamer. Love playing RPGs and FPS games.",
        avatar: "👩‍🎮",
        friends: [1, 3, 5]
    },
    {
        id: 3,
        name: "Mike Johnson",
        age: 30,
        email: "mike.j@example.com",
        city: "Chicago",
        bio: "Professional gamer and esports coach. Always looking for new challenges.",
        avatar: "👨‍🏫",
        friends: [1, 2, 4, 6]
    },
    {
        id: 4,
        name: "Sarah Williams",
        age: 27,
        email: "sarah.w@example.com",
        city: "Miami",
        bio: "Game designer and artist. Creating immersive worlds is my passion.",
        avatar: "👩‍🎨",
        friends: [1, 3, 5, 6]
    },
    {
        id: 5,
        name: "David Brown",
        age: 32,
        email: "david.b@example.com",
        city: "Seattle",
        bio: "Indie game developer. Building the next big hit game.",
        avatar: "👨‍💼",
        friends: [2, 4, 6]
    },
    {
        id: 6,
        name: "Emily Davis",
        age: 24,
        email: "emily.d@example.com",
        city: "Boston",
        bio: "Gaming content creator and YouTuber. Sharing gaming experiences with the world.",
        avatar: "👩‍💻",
        friends: [3, 4, 5]
    }
];

export default function Test1Page() {
    const [selectedPerson, setSelectedPerson] = useState(null);
    const [selectedFriend, setSelectedFriend] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showFriends, setShowFriends] = useState(false);
    const [selectedFriends, setSelectedFriends] = useState([]); // Array of selected friend IDs

    // Filter people based on search query
    const filteredPeople = peopleData.filter(person =>
        person.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        person.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        person.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Get friend details by ID
    const getFriendById = (friendId) => {
        return peopleData.find(person => person.id === friendId);
    };

    // Get selected person's friends list
    const getFriendsList = () => {
        if (!selectedPerson || !showFriends) return [];
        return selectedPerson.friends.map(friendId => getFriendById(friendId)).filter(Boolean);
    };

    const handlePersonClick = (person) => {
        setSelectedPerson(person);
        setSelectedFriend(null); // Reset friend selection when person changes
        setShowFriends(false); // Reset friends list visibility
        setSelectedFriends([]); // Reset selected friends
    };

    const handleShowFriends = () => {
        setShowFriends(true);
        setSelectedFriend(null); // Reset friend selection when showing friends
    };

    const handleFriendClick = (friend) => {
        setSelectedFriend(friend);
    };

    // Handle multi-select friend checkbox
    const handleFriendSelect = (friendId) => {
        setSelectedFriends(prev => {
            if (prev.includes(friendId)) {
                // Remove if already selected
                return prev.filter(id => id !== friendId);
            } else {
                // Add if not selected
                return [...prev, friendId];
            }
        });
    };

    // Get selected friends details
    const getSelectedFriendsDetails = () => {
        return selectedFriends.map(friendId => getFriendById(friendId)).filter(Boolean);
    };

    return (
        <div className="d-flex justify-content-center align-items-start p-4" style={{ minHeight: '100vh', flexWrap: 'wrap', gap: '15px' }}>
            {/* Panel 1: List of People */}
            <div className="border p-4 card rounded" style={{ minHeight: '400px', maxHeight: '600px', overflowY: 'auto', width: '18%', minWidth: '200px' }}>
                <h2 className="mb-3">People List</h2>
                {/* Search Bar */}
                <div className="mb-3">
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Search by name, city, or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="list-group">
                    {filteredPeople.length > 0 ? (
                        filteredPeople.map((person) => (
                            <button
                                key={person.id}
                                className={`list-group-item list-group-item-action ${selectedPerson?.id === person.id ? 'active' : ''}`}
                                onClick={() => handlePersonClick(person)}
                                style={{ cursor: 'pointer', textAlign: 'left' }}
                            >
                                <div className="d-flex align-items-center">
                                    <span style={{ fontSize: '24px', marginRight: '10px' }}>{person.avatar}</span>
                                    <div>
                                        <strong>{person.name}</strong>
                                        <br />
                                        <small className="text-muted">{person.city}</small>
                                    </div>
                                </div>
                            </button>
                        ))
                    ) : (
                        <div className="text-center text-muted p-3">
                            <p>No people found</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Panel 2: Selected Person's Profile */}
            <div className="border p-4 card rounded" style={{ minHeight: '400px', width: '18%', minWidth: '200px' }}>
                <h2 className="mb-3">Profile</h2>
                {selectedPerson ? (
                    <div>
                        <div className="text-center mb-3">
                            <div style={{ fontSize: '64px' }}>{selectedPerson.avatar}</div>
                            <h3 
                                style={{ cursor: 'pointer', color: '#0d6efd' }}
                                onClick={handleShowFriends}
                                onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                                onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                            >
                                {selectedPerson.name}
                            </h3>
                            <small className="text-muted">Click name to view friends</small>
                        </div>
                        <div className="mb-2">
                            <strong>Age:</strong> {selectedPerson.age}
                        </div>
                        <div className="mb-2">
                            <strong>Email:</strong> {selectedPerson.email}
                        </div>
                        <div className="mb-2">
                            <strong>City:</strong> {selectedPerson.city}
                        </div>
                        <div className="mb-3">
                            <strong>Bio:</strong> {selectedPerson.bio}
                        </div>
                        <button
                            className="btn btn-primary w-100"
                            onClick={handleShowFriends}
                        >
                            View Friends ({selectedPerson.friends.length})
                        </button>
                    </div>
                ) : (
                    <div className="text-center text-muted" style={{ marginTop: '150px' }}>
                        <p>Click on a person from Panel 1 to view their profile</p>
                    </div>
                )}
            </div>

            {/* Panel 3: Multi-Select Friends */}
            <div className="border p-4 card rounded" style={{ minHeight: '400px', maxHeight: '600px', overflowY: 'auto', width: '18%', minWidth: '200px' }}>
                <h2 className="mb-3">Select Friends</h2>
                {showFriends && selectedPerson ? (
                    <div>
                        <p className="text-muted mb-3">Select multiple friends of {selectedPerson.name}:</p>
                        <div className="mb-2">
                            <small className="text-info">Selected: {selectedFriends.length} friend(s)</small>
                        </div>
                        <div className="list-group">
                            {getFriendsList().map((friend) => (
                                <div
                                    key={friend.id}
                                    className={`list-group-item ${selectedFriends.includes(friend.id) ? 'active' : ''}`}
                                    style={{ cursor: 'pointer', textAlign: 'left' }}
                                    onClick={() => handleFriendSelect(friend.id)}
                                >
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="checkbox"
                                            className="form-check-input me-3"
                                            checked={selectedFriends.includes(friend.id)}
                                            onChange={() => handleFriendSelect(friend.id)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <span style={{ fontSize: '24px', marginRight: '10px' }}>{friend.avatar}</span>
                                        <div>
                                            <strong>{friend.name}</strong>
                                            <br />
                                            <small className="text-muted">{friend.city}</small>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-muted" style={{ marginTop: '150px' }}>
                        <p>Click on person's name in Panel 2 to select their friends</p>
                    </div>
                )}
            </div>

            {/* Panel 4: Selected Friends List */}
            <div className="border p-4 card rounded" style={{ minHeight: '400px', maxHeight: '600px', overflowY: 'auto', width: '18%', minWidth: '200px' }}>
                <h2 className="mb-3">Selected Friends List</h2>
                {selectedFriends.length > 0 ? (
                    <div>
                        <p className="text-muted mb-3">Selected friends ({selectedFriends.length}):</p>
                        <div className="list-group">
                            {getSelectedFriendsDetails().map((friend) => (
                                <button
                                    key={friend.id}
                                    className={`list-group-item list-group-item-action ${selectedFriend?.id === friend.id ? 'active' : ''}`}
                                    onClick={() => handleFriendClick(friend)}
                                    style={{ cursor: 'pointer', textAlign: 'left' }}
                                >
                                    <div className="d-flex align-items-center">
                                        <span style={{ fontSize: '24px', marginRight: '10px' }}>{friend.avatar}</span>
                                        <div>
                                            <strong>{friend.name}</strong>
                                            <br />
                                            <small className="text-muted">{friend.city}</small>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-muted" style={{ marginTop: '150px' }}>
                        <p>Select friends from Panel 3 to view them here</p>
                    </div>
                )}
            </div>

            {/* Panel 5: Selected Friend's Profile */}
            <div className="border p-4 card rounded" style={{ minHeight: '400px', width: '18%', minWidth: '200px' }}>
                <h2 className="mb-3">Friend's Profile</h2>
                {selectedFriend ? (
                    <div>
                        <div className="text-center mb-3">
                            <div style={{ fontSize: '64px' }}>{selectedFriend.avatar}</div>
                            <h3>{selectedFriend.name}</h3>
                        </div>
                        <div className="mb-2">
                            <strong>Age:</strong> {selectedFriend.age}
                        </div>
                        <div className="mb-2">
                            <strong>Email:</strong> {selectedFriend.email}
                        </div>
                        <div className="mb-2">
                            <strong>City:</strong> {selectedFriend.city}
                        </div>
                        <div className="mb-3">
                            <strong>Bio:</strong> {selectedFriend.bio}
                        </div>
                        <div className="alert alert-info">
                            <small>Friends: {selectedFriend.friends.length}</small>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-muted" style={{ marginTop: '150px' }}>
                        <p>Click on a friend from Panel 4 to view their profile</p>
                    </div>
                )}
            </div>
        </div>
    );
}
