import { Route, Router, Switch } from "wouter";
import { IndexPage } from "./IndexPage";

export const AppRouter = () => {
  return (
    <Router>
      <Switch>
        <Route path="/:trainId?" component={IndexPage} />

        <Route>
          <div>404</div>
        </Route>
      </Switch>
    </Router>
  );
};
