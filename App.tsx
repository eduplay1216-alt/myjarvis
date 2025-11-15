import React from 'react';
import { AppProvider, useAppContext } from './src/context/AppContext';
import { Auth } from './components/Auth';
import { ChatLayout } from './src/components/ChatLayout';

const Main: React.FC = () => {
    const { session } = useAppContext();
    if (!session) {
        return <Auth />;
    }
    return <ChatLayout />;
};

const App: React.FC = () => {
    return (
        <AppProvider>
            <Main />
        </AppProvider>
    );
};

export default App;
